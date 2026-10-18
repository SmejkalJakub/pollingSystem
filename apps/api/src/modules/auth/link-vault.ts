import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../../errors';
import { isSecret, secretHash } from './crypto';

const keyIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const keysSchema = z.record(keyIdSchema, z.string().regex(/^[0-9a-fA-F]{64}$/));
type LinkIdentity = { eventId: string; jurorId: string; tokenHash: string };
const unavailable = () =>
  new AppError(
    503,
    'LINK_STORAGE_UNAVAILABLE',
    'Personal link storage is unavailable. Restore the configured encryption keys.',
  );
const associatedData = (identity: LinkIdentity) =>
  Buffer.from(
    JSON.stringify([
      'd21-juror-link-v1',
      identity.eventId.toLowerCase(),
      identity.jurorId.toLowerCase(),
      identity.tokenHash,
    ]),
  );

// Keys are injected from server configuration, never persisted with ciphertext.
export function createLinkVault(rawKeys?: string, activeKeyId?: string) {
  let keys: Record<string, string> = {};
  if (rawKeys || activeKeyId) {
    try {
      keys = keysSchema.parse(JSON.parse(rawKeys ?? ''));
      keyIdSchema.parse(activeKeyId);
      if (!Object.hasOwn(keys, activeKeyId!)) throw new Error();
    } catch {
      throw new Error(
        'Invalid configuration: JUROR_LINK_KEYS / JUROR_LINK_ACTIVE_KEY_ID',
      );
    }
  }
  return {
    encrypt(token: string, identity: LinkIdentity) {
      if (!activeKeyId || !keys[activeKeyId]) throw unavailable();
      const nonce = randomBytes(12);
      const cipher = createCipheriv(
        'aes-256-gcm',
        Buffer.from(keys[activeKeyId], 'hex'),
        nonce,
      );
      cipher.setAAD(associatedData(identity));
      const ciphertext = Buffer.concat([
        cipher.update(token, 'utf8'),
        cipher.final(),
      ]);
      return [
        'v1',
        activeKeyId,
        nonce.toString('base64url'),
        ciphertext.toString('base64url'),
        cipher.getAuthTag().toString('base64url'),
      ].join('.');
    },
    decrypt(envelope: string, identity: LinkIdentity) {
      try {
        const [version, keyId, nonce, ciphertext, tag, extra] =
          envelope.split('.');
        if (
          version !== 'v1' ||
          !keyId ||
          !Object.hasOwn(keys, keyId) ||
          !nonce ||
          !ciphertext ||
          !tag ||
          extra !== undefined
        )
          throw new Error();
        const iv = Buffer.from(nonce, 'base64url');
        const authTag = Buffer.from(tag, 'base64url');
        if (iv.length !== 12 || authTag.length !== 16) throw new Error();
        const decipher = createDecipheriv(
          'aes-256-gcm',
          Buffer.from(keys[keyId]!, 'hex'),
          iv,
        );
        decipher.setAAD(associatedData(identity));
        decipher.setAuthTag(authTag);
        const token = Buffer.concat([
          decipher.update(Buffer.from(ciphertext, 'base64url')),
          decipher.final(),
        ]).toString('utf8');
        if (!isSecret(token) || secretHash(token) !== identity.tokenHash)
          throw new Error();
        return token;
      } catch {
        // Do not log crypto errors, envelopes, keys or recovered plaintext.
        throw unavailable();
      }
    },
  };
}
export type LinkVault = ReturnType<typeof createLinkVault>;
