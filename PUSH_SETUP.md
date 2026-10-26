# My Routine — Web Push setup

The Web Push frontend and Cloudflare Worker backend are committed on feature/web-push-reminders. **They are not deployed.** To receive notifications when the phone is locked or app closed, deploy the backend and the updated HTTPS website.

1. Install Node.js 20+ and create a Cloudflare account.
2. In push-server run npm install, npm test, npm run check, then npx wrangler login.
3. Run npx wrangler d1 create my-routine-push and copy the resulting database_id into wrangler.jsonc.
4. Edit APP_ORIGIN to the real website origin (scheme and domain, no path). Set VAPID_SUBJECT to your mailto: address.
5. Run npx wrangler d1 execute my-routine-push --remote --file=schema.sql.
6. Generate matching keys with npx --yes web-push generate-vapid-keys. Add secrets using npx wrangler secret put VAPID_PUBLIC_KEY and npx wrangler secret put VAPID_PRIVATE_KEY. Never commit the private key. Store both keys securely.
7. Run npx wrangler deploy. Put its HTTPS Worker URL into js/push-config.js.
8. Deploy the new frontend over HTTPS and enable notifications in the app. On iPhone install the PWA to the Home Screen before requesting permission. Test on a locked device.

Push may be delayed by connectivity, platform restrictions or Cron timing. Browser routines remain in localStorage; schedule changes synchronize when the app is active and online. The Worker stores a push endpoint, routine titles/times, today’s completion IDs and settings. Do not deploy publicly to many users without authentication and rate limiting. Check Worker logs during live tests. Nothing has been merged to main.

## Reminder time zone

Notification settings now offer **Follow device time automatically** (default) or **Keep current time zone when travelling**. The fixed option captures the device's current IANA time zone when selected. Changing the setting syncs to the Worker while online. In device mode, the browser re-detects a changed zone when you open/focus the app, return to it, come online, or while it remains open; this includes daylight saving changes handled by the IANA time-zone database. The Worker schedules against the most recently synced zone. **A device that changes time zones while the app remains completely closed cannot inform the Worker until the app is reopened**, so fully automatic travel updates while closed aren't guaranteed. The main routine list and completion date still use the device's local date even when reminder mode is fixed.
