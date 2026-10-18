import { z } from 'zod';
import { AppError } from './errors';
export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new AppError(
      400,
      'INVALID_REQUEST',
      'Check the supplied fields and identifiers.',
    );
  return result.data;
}
