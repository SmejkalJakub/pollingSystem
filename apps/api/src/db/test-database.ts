import type { Pool } from 'pg';

// Test-only cleanup. Call after closing every pool using the generated database.
export async function dropTestDatabase(admin: Pool, name: string) {
  if (
    !/^d21_(?:(?:auth|events|votings)_test|test|upgrade)_[0-9a-f]{32}$/.test(
      name,
    )
  )
    throw new Error(
      'Refusing to drop a database without a generated test name.',
    );
  // Pool shutdown may precede PostgreSQL observing the socket close. A forced
  // drop here races that close and emits an unhandled error from a closing client.
  const until = Date.now() + 3000;
  while (true) {
    const result = await admin.query(
      'SELECT 1 FROM pg_stat_activity WHERE datname=$1',
      [name],
    );
    if (!result.rowCount) break;
    if (Date.now() >= until)
      throw new Error(
        'Disposable database still has open connections after pool shutdown.',
      );
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  await admin.query(`DROP DATABASE "${name}"`);
}
