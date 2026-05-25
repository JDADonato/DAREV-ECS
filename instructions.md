# Whole Workflow Instructions

Created: 2026-05-25

## Purpose

Use this guide to test the system as one business process across Customer, Marketing, Accounting, and Admin users.

The goal is to see the workflow as a real catering business:

1. Customer creates an event plan.
2. Marketing reviews and coordinates.
3. Accounting handles payments and refunds.
4. Admin supervises the business.
5. Customer receives clear next actions.

## Before Testing

1. Run migrations:

   ```bash
   .\php\php.exe artisan migrate
   ```

2. Build frontend assets:

   ```bash
   npm.cmd run build
   ```

3. Start the app:

   ```bash
   .\php\php.exe artisan serve --host=127.0.0.1 --port=8008
   ```

4. Open:

   ```text
   http://127.0.0.1:8008
   ```

## Recommended Test Accounts

Use the seeded/demo accounts currently available in your environment.

Roles to test:

- Customer / Client
- Marketing
- Accounting
- Admin

## Full Business Workflow

## Phase 1: Customer Starts A Booking

Login as a customer.

Steps:

1. Go to the home page.
2. Click `Book Now`.
3. Complete the booking wizard:
   - event type
   - date and time
   - guest count
   - package choice
   - menu selection
   - venue/contact details
   - tasting preference
4. Review the final booking modal.
5. Submit the booking.

Expected result:

- Booking is created.
- Customer returns to or can open the customer dashboard.
- Booking appears as submitted/pending review.
- Customer should not need to reload manually to see dashboard changes after fetching completes.

## Phase 2: Customer Dashboard Next Action

Still as the customer, open the customer dashboard.

Check:

1. The new booking appears in the event selector.
2. The dashboard shows the event status.
3. The journey tracker shows booking review/payment steps.
4. Payment actions stay locked until the booking is approved.

Expected result:

- Customer sees that the booking is under review.
- Customer understands that payment comes after staff approval.

## Phase 3: Marketing Booking Intake

Logout and login as Marketing.

Go to:

```text
/dashboard/marketing
```

Open the `Booking Review` tab.

Check:

1. The submitted customer booking appears in the intake queue.
2. The queue shows:
   - booking reference
   - customer name
   - date
   - guest count
   - owner/assignment state
   - review status
3. Click `Claim`.

Expected result:

- Booking is assigned to the Marketing user.
- Owner changes from `Unassigned` to the staff username.
- Review status moves toward `Under Review`.

## Phase 4: Marketing Requests Customer Details

In the Marketing booking queue:

1. Click `Ask details`.
2. Enter a short request, for example:

   ```text
   Please confirm the exact venue floor and whether the team can access the service elevator.
   ```

3. Submit the request.

Expected result:

- Booking review status becomes `Needs Customer Details`.
- Request appears in the booking detail modal.
- Customer dashboard will show the request as a next action.

## Phase 5: Customer Responds To Staff Request

Logout and login again as the customer.

Open the customer dashboard.

Check:

1. A `Details requested` panel appears.
2. The staff request is visible in plain language.
3. Enter a response.
4. Click `Send Response`.

Expected result:

- Customer sees response sent.
- Booking review status updates to `Clarification Received`.
- Marketing can now continue reviewing.

## Phase 6: Marketing Reviews Customer Response

Logout and login as Marketing.

Open `Booking Review`.

Check:

1. Booking shows that the customer responded.
2. Open the booking detail modal.
3. Confirm the customer response is visible.
4. If the booking is feasible, click `Approve`.

Expected result:

- Booking status changes to `Confirmed`.
- Review status becomes `Approved For Reservation`.
- Customer can now proceed to payment.

## Phase 7: Customer Pays Through PayMongo

Login as the customer again.

Open the customer dashboard.

Go to `Payments`.

Steps:

1. Confirm the next payment is now available.
2. Click the payment/checkout action.
3. Complete PayMongo test checkout.
4. Return to the site.

Expected result:

- Payment checkout opens.
- PayMongo webhook should update the local payment when configured.
- Customer dashboard payment state should reflect paid/pending after refresh/fetch.

Important:

For a true end-to-end payment test, PayMongo webhook must be reachable by PayMongo. In local development, use ngrok or another HTTPS tunnel.

## Phase 8: Accounting Payment Verification

Login as Accounting.

Go to:

```text
/dashboard/accounting
```

Check:

1. Open `Payment Verification`.
2. Review pending and completed payment filters.
3. Confirm payment amounts show correctly.
4. Use verification actions only for staff-approved/manual verification cases.
5. Open `Ledger` to view payment history.

Expected result:

- Accounting owns payment review.
- Marketing can see payment state, but Accounting handles payment correctness.

## Phase 9: Event Preparation

Login as Marketing or Admin.

Use the booking detail modal and dashboard views to check:

1. event date/time
2. venue and access details
3. guest count
4. selected package/menu
5. tasting preference
6. payment status
7. live event status

Expected result:

- Staff can understand what must be prepared.
- If details are missing, Marketing asks the customer instead of guessing.

## Phase 10: Event Status Updates

In Marketing, open the booking detail modal for an approved booking.

Update live status:

1. Not Started
2. On the Way
3. Preparing
4. Serving
5. Completed

Expected result:

- Live status updates without changing unrelated booking details.
- Customer-facing status can use this state where displayed.

## Phase 11: Refund Or Cancellation

Customer may cancel if allowed by rules.

Accounting/Admin should then:

1. Open refund queue.
2. Review refundable amount.
3. Process refund if eligible.
4. Confirm PayMongo provider payment references exist.
5. Track status until complete.

Expected result:

- Refund work belongs to Accounting/Admin.
- Marketing should not process money movement.

## Phase 12: Admin Overview

Login as Admin.

Go to:

```text
/dashboard/admin
```

Check:

1. Overview shows business status.
2. Bookings tab shows booking pipeline.
3. Analytics tab shows operational metrics.
4. Reports tab can build and export reports.
5. Announcements can be managed.
6. Users and Business Setup remain available under management.

Expected result:

- Admin supervises the business.
- Admin does not need to manually own every booking or payment.

## Role Responsibilities

## Customer

Customer should:

- create booking
- answer staff requests
- pay payment steps
- update allowed details
- communicate with staff
- review tasting/payment/event state

Customer should not:

- verify their own payment
- change locked event details
- access other customers' data

## Marketing

Marketing should:

- claim and review bookings
- ask for customer clarification
- approve feasible bookings
- coordinate tasting
- manage customer communication
- prepare event details

Marketing should not:

- verify real payments
- process refunds
- change sensitive accounting records

## Accounting

Accounting should:

- verify payments
- monitor overdue balances
- reconcile PayMongo/local payment state
- send payment reminders
- process refunds
- manage ledger views

Accounting should not:

- approve menu/package fit
- own customer event coordination

## Admin

Admin should:

- supervise the whole workflow
- manage staff/accounts
- configure business rules
- review reports/analytics
- override sensitive cases
- audit important actions

Admin should not:

- be required to manually process every booking

## Current Implemented Workflow Backbone

Implemented now:

- Booking review status.
- Marketing booking assignment/claiming.
- Marketing clarification request.
- Customer clarification response.
- Customer dashboard next-action panel for requested details.
- Marketing intake queue now shows ownership and clarification state.
- Approved bookings move to `Approved For Reservation`.

Still recommended next:

- Dedicated event preparation board.
- Formal refund case records.
- Staff task assignments per event.
- Post-event feedback system.
- Full payment exception/reconciliation queue.
- Role-specific report presets.

## Quick Smoke Test

Use this shorter test if you only have a few minutes:

1. Customer submits booking.
2. Marketing opens Booking Review.
3. Marketing claims booking.
4. Marketing asks for details.
5. Customer dashboard shows request.
6. Customer responds.
7. Marketing sees response.
8. Marketing approves booking.
9. Customer sees payment action.
10. Accounting sees payment work.

If those ten steps work, the core customer-to-staff handoff is working.
