import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readEnvironment } from '../config';

// Always create a disposable database. Never truncate or migrate the configured database.
const databaseName = `d21_test_${randomUUID().replaceAll('-', '')}`;
const baseUrl = process.env.TEST_DATABASE_URL ?? readEnvironment().DATABASE_URL;
const admin = new pg.Pool({
  connectionString: baseUrl,
  max: 2,
  connectionTimeoutMillis: 3000,
});
const testUrl = new URL(baseUrl);
testUrl.pathname = `/${databaseName}`;
const pool = new pg.Pool({
  connectionString: testUrl.toString(),
  max: 4,
  connectionTimeoutMillis: 3000,
});
const migrationOptions = {
  migrationsFolder: fileURLToPath(new URL('./migrations', import.meta.url)),
};
let created = false;

async function fixture() {
  const eventA = randomUUID(),
    eventB = randomUUID();
  const groupA = randomUUID(),
    groupB = randomUUID();
  const jurorA = randomUUID(),
    jurorB = randomUUID();
  const votingA = randomUUID(),
    votingA2 = randomUUID(),
    votingB = randomUUID();
  const itemA = randomUUID(),
    itemA2 = randomUUID(),
    itemB = randomUUID();
  const ballotA = randomUUID();
  await pool.query('INSERT INTO events (id, name) VALUES ($1, $3), ($2, $3)', [
    eventA,
    eventB,
    'Test event',
  ]);
  await pool.query(
    "INSERT INTO jury_groups (id, event_id, code, name) VALUES ($1, $2, 'T', 'Technical'), ($3, $4, 'V', 'Second')",
    [groupA, eventA, groupB, eventB],
  );
  await pool.query(
    'INSERT INTO event_jurors (id, event_id, jury_group_id, display_name) VALUES ($1, $2, $3, $7), ($4, $5, $6, $7)',
    [jurorA, eventA, groupA, jurorB, eventB, groupB, 'Same name'],
  );
  await pool.query(
    "INSERT INTO votings (id, event_id, name, kind) VALUES ($1, $2, 'Overall', 'final'), ($3, $2, 'Idea', 'final'), ($4, $5, 'Selection', 'selection')",
    [votingA, eventA, votingA2, votingB, eventB],
  );
  await pool.query(
    'INSERT INTO voting_items (id, event_id, voting_id, name) VALUES ($1, $2, $3, $9), ($4, $2, $5, $9), ($6, $7, $8, $9)',
    [itemA, eventA, votingA, itemA2, votingA2, itemB, eventB, votingB, 'Team'],
  );
  await pool.query(
    'INSERT INTO ballots (id, event_id, voting_id, juror_id) VALUES ($1, $2, $3, $4)',
    [ballotA, eventA, votingA, jurorA],
  );
  return {
    eventA,
    eventB,
    groupA,
    groupB,
    jurorA,
    jurorB,
    votingA,
    votingA2,
    votingB,
    itemA,
    itemA2,
    itemB,
    ballotA,
  };
}

describe('PostgreSQL migrations and integrity', () => {
  beforeAll(async () => {
    // The identifier is internally generated from UUID hex, not user input.
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    created = true;
    await migrate(drizzle(pool), migrationOptions);
  });

  afterAll(async () => {
    await pool.end();
    try {
      if (created)
        await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    } finally {
      await admin.end();
    }
  });

  it('applies migrations again without changing the recorded migration count', async () => {
    const before = await pool.query(
      'SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations',
    );
    await migrate(drizzle(pool), migrationOptions);
    const after = await pool.query(
      'SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations',
    );
    expect(before.rows[0].count).toBeGreaterThan(0);
    expect(after.rows[0].count).toBe(before.rows[0].count);
    const tables = await pool.query(
      "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
    );
    expect(tables.rows[0].count).toBe(13);
  });

  it('permits duplicate display names without using them as identity', async () => {
    const f = await fixture();
    await pool.query(
      'INSERT INTO event_jurors (event_id, jury_group_id, display_name) VALUES ($1, $2, $3)',
      [f.eventA, f.groupA, 'Same name'],
    );
    const result = await pool.query(
      'SELECT count(*)::int AS count FROM event_jurors WHERE event_id = $1',
      [f.eventA],
    );
    expect(result.rows[0].count).toBe(2);
  });

  it('rejects assigning a juror to a group in another event', async () => {
    const f = await fixture();
    await expect(
      pool.query(
        'INSERT INTO event_jurors (event_id, jury_group_id, display_name) VALUES ($1, $2, $3)',
        [f.eventA, f.groupB, 'Invalid'],
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('rejects cross-event voting-group permissions', async () => {
    const f = await fixture();
    await expect(
      pool.query(
        'INSERT INTO voting_allowed_groups (event_id, voting_id, jury_group_id) VALUES ($1, $2, $3)',
        [f.eventA, f.votingA, f.groupB],
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('rejects cross-event ballot ownership and cross-event items', async () => {
    const f = await fixture();
    await expect(
      pool.query(
        'INSERT INTO ballots (event_id, voting_id, juror_id) VALUES ($1, $2, $3)',
        [f.eventA, f.votingA, f.jurorB],
      ),
    ).rejects.toMatchObject({ code: '23503' });
    await expect(
      pool.query(
        'INSERT INTO ballots (event_id, voting_id, juror_id) VALUES ($1, $2, $3)',
        [f.eventA, f.votingB, f.jurorA],
      ),
    ).rejects.toMatchObject({ code: '23503' });
    await expect(
      pool.query(
        'INSERT INTO voting_items (event_id, voting_id, name) VALUES ($1, $2, $3)',
        [f.eventA, f.votingB, 'Invalid'],
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('allows only one ballot per voting and juror under concurrent inserts', async () => {
    const f = await fixture();
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        pool.query(
          'INSERT INTO ballots (event_id, voting_id, juror_id) VALUES ($1, $2, $3)',
          [f.eventA, f.votingA2, f.jurorA],
        ),
      ),
    );
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected?.reason).toMatchObject({ code: '23505' });
  });

  it('rejects entries referencing another voting, even in the same event', async () => {
    const f = await fixture();
    await expect(
      pool.query(
        'INSERT INTO ballot_entries (event_id, voting_id, ballot_id, voting_item_id, vote_value) VALUES ($1, $2, $3, $4, 1)',
        [f.eventA, f.votingA, f.ballotA, f.itemA2],
      ),
    ).rejects.toMatchObject({ code: '23503' });
    await expect(
      pool.query(
        'INSERT INTO ballot_entries (event_id, voting_id, ballot_id, voting_item_id, vote_value) VALUES ($1, $2, $3, $4, 1)',
        [f.eventA, f.votingA2, f.ballotA, f.itemA2],
      ),
    ).rejects.toMatchObject({ code: '23503' });
    await expect(
      pool.query(
        'INSERT INTO ballot_entries (event_id, voting_id, ballot_id, voting_item_id, vote_value) VALUES ($1, $2, $3, $4, 1)',
        [f.eventA, f.votingA, f.ballotA, f.itemB],
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it.each([0, 2, -2])('rejects vote value %i', async (voteValue) => {
    const f = await fixture();
    await expect(
      pool.query(
        'INSERT INTO ballot_entries (event_id, voting_id, ballot_id, voting_item_id, vote_value) VALUES ($1, $2, $3, $4, $5)',
        [f.eventA, f.votingA, f.ballotA, f.itemA, voteValue],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('accepts either sign but rejects two entries for the same ballot item', async () => {
    const f = await fixture();
    await pool.query(
      'INSERT INTO ballot_entries (event_id, voting_id, ballot_id, voting_item_id, vote_value) VALUES ($1, $2, $3, $4, -1)',
      [f.eventA, f.votingA, f.ballotA, f.itemA],
    );
    await expect(
      pool.query(
        'INSERT INTO ballot_entries (event_id, voting_id, ballot_id, voting_item_id, vote_value) VALUES ($1, $2, $3, $4, 1)',
        [f.eventA, f.votingA, f.ballotA, f.itemA],
      ),
    ).rejects.toMatchObject({ code: '23505' });
    await pool.query(
      'UPDATE ballot_entries SET vote_value = 1 WHERE ballot_id = $1',
      [f.ballotA],
    );
    expect(
      (
        await pool.query(
          'SELECT vote_value FROM ballot_entries WHERE ballot_id = $1',
          [f.ballotA],
        )
      ).rows[0].vote_value,
    ).toBe(1);
  });

  it('rolls back a new ballot when an entry fails in the same transaction', async () => {
    const f = await fixture();
    const ballotId = randomUUID();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO ballots (id, event_id, voting_id, juror_id) VALUES ($1, $2, $3, $4)',
        [ballotId, f.eventA, f.votingA2, f.jurorA],
      );
      await expect(
        client.query(
          'INSERT INTO ballot_entries (event_id, voting_id, ballot_id, voting_item_id, vote_value) VALUES ($1, $2, $3, $4, 0)',
          [f.eventA, f.votingA2, ballotId, f.itemA2],
        ),
      ).rejects.toMatchObject({ code: '23514' });
      await client.query('ROLLBACK');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
    expect(
      (await pool.query('SELECT id FROM ballots WHERE id = $1', [ballotId]))
        .rowCount,
    ).toBe(0);
  });

  it('rejects invalid limits and inconsistent submission timestamps', async () => {
    const f = await fixture();
    await expect(
      pool.query('UPDATE votings SET max_plus_votes = -1 WHERE id = $1', [
        f.votingA,
      ]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query(
        'UPDATE votings SET allow_negative_votes = false, max_minus_votes = 1 WHERE id = $1',
        [f.votingA],
      ),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query("UPDATE ballots SET status = 'submitted' WHERE id = $1", [
        f.ballotA,
      ]),
    ).rejects.toMatchObject({ code: '23514' });
    await pool.query(
      "UPDATE ballots SET status = 'submitted', submitted_at = now() WHERE id = $1",
      [f.ballotA],
    );
  });

  it('restricts deletion of referenced records rather than cascading away history', async () => {
    const f = await fixture();
    await expect(
      pool.query('DELETE FROM events WHERE id = $1', [f.eventA]),
    ).rejects.toMatchObject({ code: '23503' });
    await expect(
      pool.query('DELETE FROM event_jurors WHERE id = $1', [f.jurorA]),
    ).rejects.toMatchObject({ code: '23503' });
  });
});
