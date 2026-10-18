import { defineConfig } from 'tsup';
import { cp } from 'node:fs/promises';

export default defineConfig({
  entry: {
    server: 'src/server.ts',
    migrate: 'src/db/migrate.ts',
    operator: 'src/modules/auth/operator.ts',
  },
  format: ['esm'],
  target: 'node22',
  clean: true,
  sourcemap: true,
  splitting: false,
  noExternal: ['@d21/contracts', '@d21/voting-domain'],
  onSuccess: async () => {
    await cp('src/db/migrations', 'dist/migrations', { recursive: true });
  },
});
