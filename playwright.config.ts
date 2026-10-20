import { defineConfig } from '@playwright/test';

// Failure-time DOM snapshots can contain a selected personal-link fallback.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    // Link fragments and passwords must not end up in stored traces/videos.
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    { name: 'phone', use: { viewport: { width: 375, height: 812 } } },
    {
      name: 'landscape-dark',
      use: {
        viewport: { width: 812, height: 375 },
        colorScheme: 'dark',
        reducedMotion: 'reduce',
      },
    },
  ],
});
