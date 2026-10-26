# My Routine — Web Push setup

The Cloudflare Worker and D1 database are deployed. The frontend is configured on `feature/web-push-reminders` and is being tested before merging into `main`.

- App: https://stonemagar.github.io/daily-routine-app/
- Worker: https://my-routine-push.stonemagar63.workers.dev
- D1: `my-routine-push` (`09db3a80-8dff-455d-82b6-3c0b412dbac8`), bound as `DB`
- Cron: `* * * * *` (every minute)
- Private VAPID key: encrypted Cloudflare Worker secret; never commit it.

## Redeployment

1. Install Node.js 24 LTS (the integration tests use built-in SQLite) and sign in to the existing Cloudflare account.
2. In push-server run npm ci, npm test, npm run check, then npx wrangler login.
3. Reuse the database ID in wrangler.jsonc. Create a new database only for a separate environment.
4. Edit APP_ORIGIN to the real website origin (scheme and domain, no path). Set VAPID_SUBJECT to your mailto: address.
5. Run npx wrangler d1 execute my-routine-push --remote --file=schema.sql.
6. Keep the existing matching VAPID keys: the public key is in wrangler.jsonc and the private key is an encrypted Worker secret. Only generate replacements intentionally; changing the public key requires devices to subscribe again. Never commit the private key.
7. Run npx wrangler deploy. Put its HTTPS Worker URL into js/push-config.js.
8. Deploy the new frontend over HTTPS and enable notifications in the app. On iPhone install the PWA to the Home Screen before requesting permission. Test on a locked device.

Push may be delayed by connectivity, platform restrictions or Cron timing. Browser routines remain in localStorage; schedule changes synchronize when the app is active and online. The Worker stores a push endpoint, routine titles/times, today’s completion IDs and settings. Do not deploy publicly to many users without authentication and rate limiting. Check Worker logs during live tests. Merge only after the live delivery checks pass.

## Reminder time zone

Notification settings now offer **Follow device time automatically** (default) or **Keep current time zone when travelling**. The fixed option captures the device's current IANA time zone when selected. Changing the setting syncs to the Worker while online. In device mode, the browser re-detects a changed zone when you open/focus the app, return to it, come online, or while it remains open; this includes daylight saving changes handled by the IANA time-zone database. The Worker schedules against the most recently synced zone. **A device that changes time zones while the app remains completely closed cannot inform the Worker until the app is reopened**, so fully automatic travel updates while closed aren't guaranteed. The main routine list and completion date still use the device's local date even when reminder mode is fixed.

## Validation before merge

Run `npm test` and `npm run check` in `push-server`. The tests cover scheduling, time zones, authentication, device isolation, endpoint validation, encryption, throttling, retries, deduplication and expired subscriptions using an in-memory SQLite database. Push-service responses are mocked in the automated tests; these tests do not prove real device delivery.

On the deployed app, enable push notifications and allow the browser permission. Send a test, create a temporary routine a few minutes ahead, and verify it arrives while the app tab is closed. Check Cloudflare scheduled invocation logs and D1 delivery records. Remove the temporary routine afterward. A locked-phone test must be performed on that phone. Do not mark this check passed based only on a successful API response.
