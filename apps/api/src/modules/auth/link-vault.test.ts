import { randomBytes, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createLinkVault } from './link-vault';
import { newSecret, secretHash } from './crypto';

const oldKey = randomBytes(32).toString('hex');
const nextKey = randomBytes(32).toString('hex');
const token = newSecret();
const identity = {
  eventId: randomUUID(),
  jurorId: randomUUID(),
  tokenHash: secretHash(token),
};
const vault = createLinkVault(JSON.stringify({ old: oldKey }), 'old');
describe('personal link authenticated encryption', () => {
  it('uses random nonces and supports retrieval after key rotation/restart', () => {
    const a = vault.encrypt(token, identity),
      b = vault.encrypt(token, identity);
    expect(a).not.toBe(b);
    expect(a).not.toContain(token);
    const restarted = createLinkVault(
      JSON.stringify({ old: oldKey, next: nextKey }),
      'next',
    );
    expect(restarted.decrypt(a, identity)).toBe(token);
    expect(
      restarted.decrypt(a, {
        ...identity,
        eventId: identity.eventId.toUpperCase(),
        jurorId: identity.jurorId.toUpperCase(),
      }),
    ).toBe(token);
    expect(restarted.decrypt(b, identity)).toBe(token);
    expect(restarted.encrypt(token, identity)).toMatch(/^v1.next\./);
  });
  it('rejects missing keys, corrupted ciphertext and swaps between events, jurors or hashes', () => {
    const encrypted = vault.encrypt(token, identity);
    for (const modified of [
      { ...identity, eventId: randomUUID() },
      { ...identity, jurorId: randomUUID() },
      { ...identity, tokenHash: secretHash(newSecret()) },
    ])
      expect(() => vault.decrypt(encrypted, modified)).toThrow(
        'Personal link storage is unavailable',
      );
    const parts = encrypted.split('.');
    parts[3] = Buffer.from('corrupted').toString('base64url');
    expect(() => vault.decrypt(parts.join('.'), identity)).toThrow(
      'Personal link storage is unavailable',
    );
    expect(() => createLinkVault().decrypt(encrypted, identity)).toThrow(
      'Personal link storage is unavailable',
    );
    expect(() => createLinkVault().encrypt(token, identity)).toThrow(
      'Personal link storage is unavailable',
    );
    expect(() =>
      createLinkVault(JSON.stringify({ old: nextKey }), 'old').decrypt(
        encrypted,
        identity,
      ),
    ).toThrow('Personal link storage is unavailable');
  });
  it('sanitizes invalid key configuration without returning secret values', () => {
    for (const [keys, id] of [
      ['private-key', 'old'],
      [JSON.stringify({ old: oldKey }), 'missing'],
      [undefined, 'old'],
      [JSON.stringify({ old: oldKey }), undefined],
    ]) {
      expect(() => createLinkVault(keys, id)).toThrow(
        /^Invalid configuration: JUROR_LINK_KEYS \/ JUROR_LINK_ACTIVE_KEY_ID$/,
      );
    }
  });
});
