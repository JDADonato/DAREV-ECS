# PayMongo Testing Guide

This guide tests the real PayMongo Checkout plus webhook flow for the ECS 10/70/20 payment milestones.

## What You Are Testing

The expected production-safe flow is:

1. ECS creates a PayMongo Checkout Session.
2. Client pays on PayMongo's hosted page.
3. PayMongo sends a signed webhook to ECS.
4. ECS verifies the webhook signature.
5. ECS marks the matching `payments` row as `Paid`.
6. ECS updates the related `bookings` milestone state.

The browser success redirect alone must not mark payments as paid.

## Prerequisites

Make sure your `.env` has:

```env
APP_URL=http://127.0.0.1:8080

PAYMONGO_BASE_URL=https://api.paymongo.com
PAYMONGO_CHECKOUT_ENDPOINT=/v1/checkout_sessions
PAYMONGO_PUBLIC_KEY=pk_test_...
PAYMONGO_SECRET_KEY=sk_test_...
PAYMONGO_WEBHOOK_SECRET=...
PAYMONGO_CURRENCY=PHP
PAYMONGO_PAYMENT_METHOD_TYPES=card,gcash,paymaya
PAYMONGO_SEND_EMAIL_RECEIPT=true
PAYMONGO_STATEMENT_DESCRIPTOR=ELOQUENTE
PAYMONGO_TIMEOUT=20
PAYMONGO_CA_BUNDLE=storage/app/cacert.pem
PAYMONGO_WEBHOOK_TOLERANCE=300
```

After editing `.env`, run:

```powershell
php artisan config:clear
```

## One-Time Database Step

Run the PayMongo payment reference migration:

```powershell
php artisan migrate --path=database/migrations/2026_05_18_223236_add_paymongo_fields_to_payments_table.php
```

If plain `php artisan migrate` fails on the old package migration, do not use it for PayMongo testing. Use the path command above.

## Start the Local App

From the project root:

```powershell
$env:PATH = ".\php;" + $env:PATH
composer run dev
```

Confirm the app opens at:

```text
http://127.0.0.1:8080
```

## Start Ngrok

In a second terminal:

```powershell
& "C:\Users\Joshua Aquino\Downloads\ngrok-v3-stable-windows-amd64\ngrok.exe" http 8080
```

Copy the HTTPS forwarding URL. Your webhook URL is:

```text
https://YOUR-NGROK-DOMAIN/webhook/paymongo
```

Ngrok's local request inspector is:

```text
http://127.0.0.1:4040
```

Use it to see whether PayMongo actually POSTed to your webhook.

## Configure PayMongo Webhook

In PayMongo Dashboard:

1. Use Test Mode.
2. Go to Developers or Webhooks.
3. Create a webhook endpoint.
4. Paste your ngrok webhook URL:

   ```text
   https://YOUR-NGROK-DOMAIN/webhook/paymongo
   ```

5. Subscribe to these events:
   - `checkout_session.payment.paid`
   - `payment.paid`

6. Save the webhook.
7. Copy the webhook signing secret.
8. Put it in `.env`:

   ```env
   PAYMONGO_WEBHOOK_SECRET=...
   ```

9. Clear Laravel config:

   ```powershell
   php artisan config:clear
   ```

## Test 1: Checkout Session Opens

1. Log in as a client.
2. Go to `/dashboard/client?tab=payments`.
3. Confirm a booking has a pending `Reservation` milestone.
4. Click `Proceed to Checkout`.
5. Expected result:
   - Browser redirects to `https://checkout.paymongo.com/...`
   - Amount equals 10% of booking total.
   - Reference number follows `ECS-{booking_id}-P{payment_id}`.

Example:

```text
ECS-11-P26
```

## Test 2: Successful Card Payment

On the PayMongo Checkout page:

1. Choose Card.
2. Use a PayMongo test card:

   | Scenario | Card number | Expected PayMongo result |
   | :--- | :--- | :--- |
   | Successful 3DS card payment | `4120000000000007` | Payment succeeds after test authorization |
   | Successful non-3DS card payment | `5555444444444457` | Payment succeeds in test mode |

3. Use any future expiry date.
4. Use any valid-looking CVC, such as `123`.
5. If PayMongo shows a test authentication page, choose the successful authorization option.
6. Complete payment.

Expected result:

- PayMongo redirects back to ECS success URL.
- Ngrok shows a POST to `/webhook/paymongo`.
- Laravel returns HTTP `200` for the webhook.

Important: if the browser returns to success but no webhook arrives, the database should not be trusted as paid yet.

## Test 3: Verify Database After 10% Payment

Check the matching payment row:

```sql
select
  id,
  booking_id,
  amount,
  payment_type,
  status,
  payment_method,
  verified_by,
  verified_at,
  paymongo_checkout_session_id,
  paymongo_payment_id,
  paymongo_payment_intent_id,
  paymongo_reference_number,
  paymongo_event_id
from payments
where id = YOUR_PAYMENT_ID;
```

Expected:

```text
status = Paid
payment_method = PayMongo, card, gcash, or paymaya
verified_by = PayMongo Webhook
verified_at is not null
paymongo_event_id is not null
```

Check the booking:

```sql
select
  id,
  status,
  live_status,
  milestone_step,
  total_cost
from bookings
where id = YOUR_BOOKING_ID;
```

Expected after 10%:

```text
status = Reserved
live_status = Reserved
milestone_step = 3
```

## Test 4: Continue 70% Progress Payment

1. Return to the client dashboard.
2. Refresh dashboard data.
3. The next payable milestone should be `DownPayment`.
4. Click `Proceed to Checkout`.
5. Confirm amount is 70% of the booking total.
6. Complete PayMongo test payment.
7. Confirm webhook returns HTTP `200`.

Expected after 10% + 70%:

```text
DownPayment payment status = Paid
booking.live_status = Progress Payment Paid
booking.milestone_step = 4
```

The booking `status` may remain `Reserved`.

## Test 5: Final 20% Payment

1. Return to the client dashboard.
2. Pay the `Final` milestone.
3. Confirm amount is the remaining 20%.
4. Complete PayMongo test payment.
5. Confirm webhook returns HTTP `200`.

Expected after all milestones:

```text
Final payment status = Paid
booking.status = Completed
booking.live_status = Payment Complete
booking.milestone_step = 5
```

## Test 6: Failed or Abandoned Payment

1. Start checkout.
2. Close the PayMongo page or use one of these failing PayMongo test scenarios:

   | Scenario | Card number | Expected PayMongo result |
   | :--- | :--- | :--- |
   | Failed non-3DS payment | `4200000000000018` | Fails with an expired-card style failure |
   | 3DS authenticated but charge fails | `5234000000000106` | Authentication passes, payment fails |
   | Failed 3DS authentication | `4120000000000007` | Choose the failed authentication option on the test authentication page |

3. Return to ECS dashboard.

Expected:

```text
payment.status remains Pending
booking status does not advance
```

If PayMongo sends a failed-payment event, the current webhook ignores it. That is intentional for this phase.

PayMongo source for these test cards: `https://developers.paymongo.com/docs/card-integration-test-cases`

## Test 7: Signature Rejection

This verifies the webhook is not publicly forgeable.

Send a fake unsigned request:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8080/webhook/paymongo `
  -ContentType "application/json" `
  -Body '{"data":{"attributes":{"type":"payment.paid"}}}'
```

Expected:

```text
HTTP 401 Invalid signature
```

## Troubleshooting

### Checkout opens but database stays Pending

Most likely cause: webhook is not configured, ngrok stopped, or `PAYMONGO_WEBHOOK_SECRET` is wrong.

Check:

```text
http://127.0.0.1:4040
```

If no request appears, PayMongo is not reaching your local app.

### Webhook shows 401

Cause: `PAYMONGO_WEBHOOK_SECRET` does not match the webhook endpoint's signing secret.

Fix:

1. Copy the webhook secret again from PayMongo.
2. Update `.env`.
3. Run:

   ```powershell
   php artisan config:clear
   ```

### Webhook shows 200 but result is unmatched

Open the request payload in ngrok and inspect:

```text
data.attributes.data.attributes.metadata
data.attributes.data.attributes.reference_number
data.attributes.data.id
```

The controller can match by:

- metadata `payment_id`
- reference number like `ECS-11-P26`
- `paymongo_checkout_session_id`
- `paymongo_payment_id`
- `paymongo_payment_intent_id`

If PayMongo sends a different payload shape, update `PayMongoWebhookController::resolvePayment()`.

### Webhook shows amount/currency mismatch

The webhook payment amount did not match the local `payments.amount`.

Check:

- The payment row amount.
- The booking total.
- The milestone type.
- The amount shown in PayMongo checkout.

Do not mark the payment paid manually until the mismatch is understood.

### cURL SSL certificate error

Keep SSL verification enabled. Make sure this file exists:

```text
storage/app/cacert.pem
```

And `.env` contains:

```env
PAYMONGO_CA_BUNDLE=storage/app/cacert.pem
```

Then run:

```powershell
php artisan config:clear
```

### Ngrok command not found

Run ngrok by full path:

```powershell
& "C:\Users\Joshua Aquino\Downloads\ngrok-v3-stable-windows-amd64\ngrok.exe" http 8080
```

## Done Criteria

The PayMongo integration is working when:

1. Checkout opens on `checkout.paymongo.com`.
2. PayMongo sends a signed webhook to ngrok.
3. Laravel returns HTTP `200` for the webhook.
4. `payments.status` changes to `Paid`.
5. `bookings.status`, `bookings.live_status`, and `bookings.milestone_step` advance according to the 10/70/20 structure.
6. A fake unsigned webhook returns HTTP `401`.
