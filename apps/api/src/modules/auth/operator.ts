import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { newAdminPasswordSchema } from '@d21/contracts';
import { readEnvironment } from '../../config';
import { createDatabase } from '../../db/client';
import { revokeAdminSessions, setAdminPassword } from './service';

// Passwords never appear in command arguments, environment variables, or terminal echo.
async function promptPassword(label: string): Promise<string> {
  if (!process.stdin.isTTY)
    throw new Error('Use an interactive terminal to set the password.');
  const muted = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const input = createInterface({
    input: process.stdin,
    output: muted,
    terminal: true,
  });
  process.stdout.write(label);
  try {
    return await new Promise<string>((resolve, reject) => {
      input.once('SIGINT', () => reject(new Error('Cancelled.')));
      input.once('close', () => reject(new Error('Input ended.')));
      input.question('', resolve);
    });
  } finally {
    input.close();
    process.stdout.write('\n');
  }
}

const command = process.argv[2];
if (!['set-password', 'revoke-sessions'].includes(command ?? '')) {
  process.stderr.write('Use set-password or revoke-sessions.\n');
  process.exitCode = 1;
} else {
  let pool: ReturnType<typeof createDatabase>['pool'] | undefined;
  try {
    if (command === 'set-password') {
      const password = await promptPassword(
        'New shared administration password (15–256 characters): ',
      );
      if (!newAdminPasswordSchema.safeParse(password).success)
        throw new Error('Use a password of 15–256 characters.');
      const confirmation = await promptPassword('Repeat password: ');
      if (password !== confirmation) throw new Error('Passwords do not match.');
      pool = createDatabase(readEnvironment().DATABASE_URL).pool;
      await setAdminPassword(pool, password);
      process.stdout.write(
        'Shared password set. All previous administration sessions were revoked.\n',
      );
    } else {
      pool = createDatabase(readEnvironment().DATABASE_URL).pool;
      const count = await revokeAdminSessions(pool);
      process.stdout.write(`Revoked ${count} administration sessions.\n`);
    }
  } catch {
    // Do not print database errors or submitted credentials.
    process.stderr.write(
      'Operation failed or was cancelled. Check input, database availability and migrations.\n',
    );
    process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}
