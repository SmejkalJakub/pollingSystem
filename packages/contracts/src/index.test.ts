import { describe, expect, it } from 'vitest';
import {
  ballotEntrySchema,
  ballotStatusSchema,
  healthResponseSchema,
} from './index';

describe('public contracts', () => {
  const votingItemId = '445b63d5-b700-46dc-ae86-aad67986c815';

  it('accepts only a single positive or negative vote for an identified item', () => {
    expect(
      ballotEntrySchema.safeParse({ votingItemId, voteValue: 1 }).success,
    ).toBe(true);
    expect(
      ballotEntrySchema.safeParse({ votingItemId, voteValue: -1 }).success,
    ).toBe(true);
    for (const voteValue of [0, 2, '1', null]) {
      expect(
        ballotEntrySchema.safeParse({ votingItemId, voteValue }).success,
      ).toBe(false);
    }
    expect(
      ballotEntrySchema.safeParse({ votingItemId: 'invalid', voteValue: 1 })
        .success,
    ).toBe(false);
    expect(
      ballotEntrySchema.safeParse({
        votingItemId,
        voteValue: 1,
        jurorId: 'injected',
      }).success,
    ).toBe(false);
  });

  it('keeps progress labels out of stored ballot states', () => {
    expect(ballotStatusSchema.safeParse('invalid_draft').success).toBe(false);
    expect(ballotStatusSchema.safeParse('locked').success).toBe(false);
  });

  it('rejects a malformed health response', () => {
    expect(healthResponseSchema.safeParse({ status: 'ok' }).success).toBe(
      false,
    );
  });
});

describe('shared administration authentication contracts', () => {
  it('requires only a password, rejects identity fields and accepts both session actors', async () => {
    const { adminLoginSchema, newAdminPasswordSchema, sessionResponseSchema } =
      await import('./index');
    expect(adminLoginSchema.safeParse({ password: 'shared' }).success).toBe(
      true,
    );
    expect(
      adminLoginSchema.safeParse({
        email: 'someone@example.test',
        password: 'shared',
      }).success,
    ).toBe(false);
    expect(adminLoginSchema.safeParse({ password: '' }).success).toBe(false);
    expect(newAdminPasswordSchema.safeParse('short').success).toBe(false);
    expect(
      sessionResponseSchema.safeParse({ authenticated: false }).success,
    ).toBe(true);
    expect(
      sessionResponseSchema.safeParse({
        authenticated: true,
        principal: { kind: 'juror' },
        expiresAt: '2026-10-16T12:00:00.000Z',
      }).success,
    ).toBe(false);
  });
});
