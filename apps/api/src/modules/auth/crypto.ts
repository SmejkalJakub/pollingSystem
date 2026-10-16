import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// OWASP scrypt baseline; native Node crypto avoids a native-addon dependency.
const options = { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 };
let active = 0;
export class PasswordBusyError extends Error {}

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  // Bound memory pressure from unauthenticated requests, without an unbounded queue.
  if (active >= 2) throw new PasswordBusyError();
  active++;
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(password, salt, 64, options, (error, key) =>
        error ? reject(error) : resolve(key),
      );
    });
  } finally {
    active--;
  }
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt:131072:8:1:${salt.toString('hex')}:${key.toString('hex')}`;
}

// Missing credentials still run the same derivation so setup is not disclosed by timing.
const dummyHash = `scrypt:131072:8:1:${'00'.repeat(16)}:${'00'.repeat(64)}`;
export async function verifyPassword(password: string, encoded = dummyHash) {
  const match = /^scrypt:131072:8:1:([0-9a-f]{32}):([0-9a-f]{128})$/.exec(
    encoded,
  );
  if (!match) return false;
  const actual = await derive(password, Buffer.from(match[1]!, 'hex'));
  return timingSafeEqual(actual, Buffer.from(match[2]!, 'hex'));
}

export const newSecret = () => randomBytes(32).toString('base64url');
export const secretHash = (secret: string) =>
  createHash('sha256').update(secret).digest('hex');
export const isSecret = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
