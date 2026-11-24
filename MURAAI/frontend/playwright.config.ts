import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'url'
import path from 'path'

/**
 * Frontend E2E setup targeting the Vite dev server.
 *
 * Two web servers are launched automatically:
 *   1. The Flask backend (port 8000) against a freshly-seeded, throwaway
 *      SQLite DB (scripts/e2e_seed.py) so every run is deterministic.
 *   2. The Vite dev server (port 5173) that the tests drive.
 *
 * The frontend talks to the backend at http://localhost:8000/api (see
 * src/api/axios.ts). Both servers share the same e2e_app.db via
 * DATABASE_URL.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKEND_DIR = '../backend'
const E2E_DB = path.resolve(__dirname, BACKEND_DIR, 'e2e_app.db')
const E2E_DB_URI = `sqlite:///${E2E_DB.replace(/\\/g, '/')}`

const baseURL = 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: `venv\\Scripts\\python.exe scripts\\e2e_seed.py && venv\\Scripts\\python.exe src\\main.py`,
      cwd: BACKEND_DIR,
      port: 8000,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DATABASE_URL: E2E_DB_URI,
        FLASK_ENV: 'staging',
        RUN_SCHEDULER: 'false',
      },
    },
    {
      command: 'npm run dev',
      cwd: '.',
      port: 5173,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})