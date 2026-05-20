# MAV Handoff - PayMongo Integration State

Date: 2026-05-18

## Current State

Phase 2 is working: clients can click `Proceed to Checkout`, Laravel creates a PayMongo Checkout Session, and the browser redirects to `checkout.paymongo.com`.

Phase 3 code has been added: PayMongo can now POST to `/webhook/paymongo`, the request signature is verified, paid events are processed, and matching local payment milestones are updated to `Paid`.

## Payment Flow Now

1. Client dashboard calls `router.post('/checkout/initialize')`.
2. `PaymentController@initializeCheckout` validates the authenticated user's booking and selected payment milestone.
3. The payable amount is calculated server-side from the booking total using the strict structure:
   - `Reservation`: 10%
   - `DownPayment`: 70%
   - `Final`: 20%
4. `PayMongoService` creates a PayMongo Checkout Session.
5. The app redirects externally with `Inertia::location($checkoutUrl)`.
6. PayMongo sends signed webhook events to `/webhook/paymongo`.
7. `PayMongoWebhookController` verifies the signature and marks the matching `payments` row as `Paid`.
8. The related `bookings` row is advanced:
   - 10% paid: `status = Reserved`, `live_status = Reserved`, `milestone_step = 3`
   - 80% paid: `live_status = Progress Payment Paid`, `milestone_step = 4`
   - 100% paid: `status = Completed`, `live_status = Payment Complete`, `milestone_step = 5`

## Files Actively Edited

- `.env.example`: PayMongo checkout, webhook, CA bundle, and timeout variables.
- `.env`: Local PayMongo values and `PAYMONGO_CA_BUNDLE`. Do not commit this file or expose real keys.
- `app/Services/PayMongoService.php`: New PayMongo Checkout API client.
- `app/Http/Controllers/PaymentController.php`: Creates checkout sessions and disables mock checkout processing.
- `app/Http/Controllers/PayMongoWebhookController.php`: New signed webhook endpoint.
- `app/Models/Payment.php`: Added PayMongo provider fields to `$fillable`.
- `database/migrations/2026_05_18_223236_add_paymongo_fields_to_payments_table.php`: Adds PayMongo reference columns.
- `routes/web.php`: Adds `POST /webhook/paymongo`.
- `bootstrap/app.php`: Exempts `webhook/paymongo` from CSRF validation.
- `config/services.php`: Adds `services.paymongo`.
- `resources/js/Pages/client/ClientDashboard.jsx`: Uses Inertia submit for checkout and treats `Reserved` as active.
- `storage/app/cacert.pem`: Current CA bundle for local Windows PHP/cURL TLS verification. This is ignored by git.
- `paymongo-testing.md`: Step-by-step PayMongo testing guide.
- `README.md`: Payment setup and troubleshooting notes.
- `app/Console/Commands/PayMongoWebhookSync.php`: Artisan command that automates ngrok + PayMongo webhook registration.

## Things Tried and Issues Found

### Frontend checkout click did nothing

Cause: `ClientDashboard.jsx` was using `fetch('/checkout/initialize')`, but the backend returns an Inertia external redirect. Raw `fetch()` does not navigate from `Inertia::location`.

Fix: Replaced with `router.post('/checkout/initialize', ...)`.

### PayMongo TLS certificate error

Error:

```text
cURL error 60: SSL certificate problem: unable to get local issuer certificate
```

Cause: Local Windows PHP/cURL was using an outdated or unsuitable CA bundle.

Fix:

- Downloaded a current CA bundle to `storage/app/cacert.pem`.
- Added `PAYMONGO_CA_BUNDLE=storage/app/cacert.pem`.
- Updated `PayMongoService` to pass that CA bundle to Laravel's HTTP client.

Verified with a direct PHP/cURL check. It returned HTTP `404`, which means TLS verification succeeded and the endpoint was reachable.

### Browser automation verification failed

The in-app browser automation connection failed with a local permission issue while trying to inspect `AppData`.

Impact: Could not complete an automated browser click verification in this session.

Mitigation: Verified by code path, `npm run build`, and manual user screenshots confirming PayMongo checkout opened.

### Plain migration command failed

First sandboxed `php artisan migrate` could not connect to Supabase because network access was blocked.

After escalation, plain `php artisan migrate` reached Supabase but failed on an older unrelated migration:

```text
2026_05_17_120000_change_package_type_to_event_type_slug
packages_type_check violation
```

Fix for this phase: Ran only the new PayMongo migration by path:

```powershell
php artisan migrate --path=database/migrations/2026_05_18_223236_add_paymongo_fields_to_payments_table.php
```

That migration succeeded. The older package migration issue still exists and should be fixed separately.

### Ngrok command not found

Cause: `ngrok.exe` was downloaded but not on PATH.

Found executable:

```text
C:\Users\Joshua Aquino\Downloads\ngrok-v3-stable-windows-amd64\ngrok.exe
```

Working command:

```powershell
& "C:\Users\Joshua Aquino\Downloads\ngrok-v3-stable-windows-amd64\ngrok.exe" http 8080
```

## Verification Already Run

```powershell
php -l app\Services\PayMongoService.php
php -l app\Http\Controllers\PaymentController.php
php -l app\Http\Controllers\PayMongoWebhookController.php
php -l app\Models\Payment.php
php artisan route:list --path=webhook
php artisan config:clear
npm.cmd run build
```

All passed.

## Next Step I Would Take

1. Keep Laravel running at `http://127.0.0.1:8080`:

   ```powershell
   composer run dev
   ```

2. In a **separate terminal**, run the automated webhook sync:

   ```powershell
   $env:PATH = ".\php;" + $env:PATH
   php artisan paymongo:webhook-sync
   ```

   This command automatically:
   - Starts ngrok (or detects an existing instance)
   - Discovers the public HTTPS URL
   - Disables old PayMongo webhooks pointing to previous ngrok URLs
   - Creates a new webhook or re-enables an existing one
   - Updates `PAYMONGO_WEBHOOK_SECRET` in `.env`
   - Clears config cache

   **You no longer need to manually create webhooks in the PayMongo Dashboard.**

3. Make a test checkout payment.
4. Watch:
   - ngrok request log at `http://127.0.0.1:4040`
   - Laravel logs in `storage/logs/laravel.log`
   - database `payments.status`
   - database `bookings.status`, `bookings.live_status`, `bookings.milestone_step`

If webhook matching fails, inspect the raw PayMongo payload in ngrok. The controller currently matches by metadata `payment_id`, reference number like `ECS-11-P26`, checkout session ID, PayMongo payment ID, or payment intent ID.

## Important Security Notes

- Never disable SSL verification to fix PayMongo TLS issues.
- Never commit `.env` or real PayMongo keys.
- Webhook updates must only happen after signature verification.
- Browser redirects are not proof of payment.
- The webhook is the source of truth for marking payments as `Paid`.

