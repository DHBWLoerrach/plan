import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  /* Room for one waited-out sign-in: the suite signs in more often than Better Auth counts per address and window. */
  timeout: 45_000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node e2e/seed.mjs && npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    env: {
      DATABASE_URL: "./data/e2e.sqlite",
      BETTER_AUTH_URL: "http://127.0.0.1:3100",
      BETTER_AUTH_SECRET: "e2e-development-secret-that-is-long-enough",
      NEXT_DIST_DIR: ".next-e2e",
      /* No calendar system is reached from here: the suite neither owns one nor may depend on the DHBW one being up.
         The address refuses the connection, so the server renders the state it renders for an unreachable feed, and
         what the calendar does from there is answered by the browser — where the tests can answer for it. */
      DHBW_CALENDAR_URL_TEMPLATE: "http://127.0.0.1:9/kal-{course}.ics",
    },
  },
});
