import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  newSecret,
  PasswordBusyError,
  secretHash,
  verifyPassword,
} from './crypto';

describe('credential protection', () => {
  it('uses unique salts, verifies the exact password, and rejects missing/malformed credentials', async () => {
    const password = 'test only shared passphrase';
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(second);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword('wrong', first)).toBe(false);
    expect(await verifyPassword(password)).toBe(false);
    expect(await verifyPassword(password, 'malformed')).toBe(false);
  });

  it('bounds concurrent password work instead of growing an unbounded queue', async () => {
    const first = hashPassword('test password one');
    const second = hashPassword('test password two');
    await expect(hashPassword('third')).rejects.toBeInstanceOf(
      PasswordBusyError,
    );
    await Promise.all([first, second]);
    expect(await hashPassword('capacity released')).toMatch(/^scrypt:/);
  });

  it('generates independent 256-bit secrets and stores fixed hashes', () => {
    const first = newSecret(),
      second = newSecret();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
    expect(secretHash(first)).toMatch(/^[0-9a-f]{64}$/);
    expect(secretHash(first)).not.toBe(first);
  });
});
