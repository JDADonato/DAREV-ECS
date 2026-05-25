# May 25 Error And Risk Review

Created: 2026-05-25

## Purpose

This file lists features, displays, workflows, and code paths that may not function well, may be broken, or may show users/staff text that should not be shown in its current form.

This is not a full bug-fix file. It is a review list for what should be corrected next.

## Review Scope

Scanned:

- backend controllers
- routes
- customer pages
- admin pages
- marketing dashboard
- accounting dashboard
- chat components
- notification wording
- payment and PayMongo flow
- recently added booking workflow handoff

## Critical Issues

## 1. Legacy Manual Payment Page Can Still Mark Payments As Verified

Files:

- `routes/web.php`
- `app/Http/Controllers/BookingController.php`
- `resources/js/Pages/client/PaymentPage.jsx`

Problem:

The client route still exists:

```text
POST /api/bookings/pay
```

The client payment page still submits directly to this route. The backend method `recordPayment()` marks pending payments as `Verified` immediately after the customer submits a method/reference number.

Why this is risky:

- Customers should not be able to directly verify payments.
- Payment truth should come from PayMongo webhook or Accounting verification.
- This can bypass PayMongo and make unpaid bookings look paid.
- It conflicts with the newer PayMongo checkout flow.

Recommended fix:

1. Remove or disable the customer-facing manual payment page.
2. Replace `/api/bookings/pay` with a proof upload endpoint if manual payment proof is still needed.
3. Store proof uploads as `Pending Review`.
4. Let Accounting mark them verified.
5. Keep PayMongo as the primary payment path.

Priority:

Critical.

## 2. Payment Page Displays Broken Peso Symbols

File:

- `resources/js/Pages/client/PaymentPage.jsx`

Problem:

The old payment page displays peso symbols as mojibake text similar to:

```text
[broken peso symbol]
```

Why this is bad:

- It looks broken to customers.
- It reduces trust during payment.
- It suggests encoding problems in a high-stakes payment screen.

Recommended fix:

Since this page should likely be removed or replaced, the better fix is to remove this legacy payment UI from customer navigation. If kept temporarily, replace the broken symbol with plain `PHP` or a correctly encoded peso sign.

Priority:

Critical if the page is reachable by customers.

## 3. PayMongo Refund Failure Message Can Expose Internal Provider Wording

File:

- `app/Http/Controllers/AccountingController.php`

Problem:

Refund errors can include PayMongo-specific failure details directly in staff UI.

Example pattern:

```text
Payment #... is missing the PayMongo payment ID needed for an API refund.
```

Why this may be a problem:

- It is useful for staff diagnosis, but it is too technical for normal accounting users.
- It can confuse staff who are not developers.
- The UI should separate "what happened" from technical diagnostics.

Recommended fix:

1. Show staff-friendly message:
   - "This payment cannot be refunded automatically yet because the original online payment reference is missing."
2. Log the technical PayMongo details for developers/admin audit.
3. Add a clear action:
   - "Review payment record"
   - "Process manually"
   - "Contact admin"

Priority:

High.

## High Priority Issues

## 4. Marketing Clarification Request Uses Browser Prompt

File:

- `resources/js/Pages/DashboardMarketing.jsx`

Problem:

The `Ask details` action uses:

```js
window.prompt('What details should the customer provide?')
```

Why this is bad:

- Browser prompts feel unfinished and unprofessional.
- Staff cannot review formatting before sending.
- It does not match the rest of the system's modal style.
- It can be cancelled or mishandled easily.

Recommended fix:

Replace the browser prompt with a branded modal:

- title: `Request Customer Details`
- textarea
- short examples/help text
- send/cancel actions
- loading state
- success/error toast

Priority:

High.

## 5. Several Staff Actions Still Use Native Browser Confirm/Alert

Files:

- `resources/js/Components/common/StaffMessaging.jsx`
- `resources/js/Pages/DashboardAccounting.jsx`
- `resources/js/Pages/DashboardAdmin.jsx`
- `resources/js/Pages/DashboardMarketing.jsx`
- `resources/js/Pages/client/ClientDashboard.jsx`

Problem:

There are still native `alert()` and `confirm()` calls for important actions such as:

- claiming/transferring conversations
- resolving conversations
- deleting event types
- deleting menu items
- deleting reports
- processing refunds
- deleting users/customers
- cancelling tastings

Why this is bad:

- Native dialogs do not match the site style.
- They interrupt the workflow abruptly.
- They are not descriptive enough for sensitive actions like refunds and deletion.
- They feel like unfinished UI.

Recommended fix:

Create shared branded modal components:

- `ConfirmModal`
- `DangerConfirmModal`
- `PromptModal`

Use them across staff and customer pages.

Priority:

High.

## 6. Admin Booking Detail Still Shows Internal Wording

File:

- `resources/js/Pages/DashboardAdmin.jsx`

Problem:

Admin event details modal still includes text like:

```text
Status Payload
Temporal Constraints
Comm Link
Execution Date
```

Why this is bad:

- These sound technical or unnatural.
- Staff should see operational language, not system/developer wording.
- It makes the admin interface feel less business-ready.

Recommended replacement:

- `Status Payload` -> `Booking Status`
- `Temporal Constraints` -> `Schedule`
- `Comm Link (Email)` -> `Email`
- `Comm Link (Phone)` -> `Phone`
- `Execution Date` -> `Event Date`

Priority:

High.

## 7. Customer-Facing Booking Failure Can Show Raw Validation Messages

File:

- `resources/js/Pages/client/BookingWizard.jsx`

Problem:

When booking submission fails, the modal title is:

```text
Booking Failed
```

The message can show raw backend validation text such as:

```text
The package id field must be a string.
```

Why this is bad:

- Customers should not see database or field names like `package id`.
- Raw validation language feels broken.
- The title sounds severe and may make customers abandon the booking.

Recommended fix:

Map backend validation errors to customer-friendly messages:

- `package_id` -> "Please choose a package again."
- `event_date` -> "Please choose an event date."
- `menu_selection` -> "Please review your selected dishes."

Use softer title:

```text
Please Review Your Booking
```

Priority:

High.

## 8. New Review Workflow Is Not Yet Reflected Everywhere

Files:

- `app/Http/Controllers/AdminController.php`
- `resources/js/Pages/DashboardAdmin.jsx`
- `resources/js/Pages/DashboardAccounting.jsx`
- `resources/js/Pages/client/ClientDashboard.jsx`

Problem:

The new workflow fields exist:

- `review_status`
- `assigned_to`
- clarification fields
- review tasks

But not every page fully uses them yet.

Likely confusion:

- Admin may still approve or display bookings mostly by `status`.
- Accounting may still focus on `Pending`, `Paid`, `Verified`, `Refunded`.
- Customer dashboard may show both old and new status concepts in different places.

Why this matters:

If one screen says `Pending`, another says `Under Review`, and another says `Confirmed`, users may not know what stage the booking is really in.

Recommended fix:

1. Create a shared booking status mapper.
2. Use one customer-facing status label set.
3. Use one staff-facing status label set.
4. Keep raw database statuses hidden behind those mappers.

Priority:

High.

## Medium Priority Issues

## 9. Payment Status Labels Are Inconsistent

Files:

- `resources/js/Pages/DashboardAccounting.jsx`
- `resources/js/Pages/client/ClientDashboard.jsx`
- `resources/js/Pages/client/PaymentSuccess.jsx`
- `app/Http/Controllers/PaymentController.php`
- `app/Http/Controllers/PayMongoWebhookController.php`

Problem:

The system uses multiple payment labels:

- `Pending`
- `Paid`
- `Verified`
- `Refunded`
- `Overdue`
- `Payment Verified`
- `PayMongo Checkout`
- `PayMongo Webhook`

Why this may confuse users:

- Customers only need to know whether a payment is due, being checked, paid, overdue, or refunded.
- Staff may need more detail, but not scattered across different terms.

Recommended fix:

Create display labels:

Customer:

- `Payment Due`
- `Being Checked`
- `Paid`
- `Overdue`
- `Refunded`

Staff:

- `Pending`
- `Checkout Started`
- `Paid Online`
- `Verified`
- `Overdue`
- `Refunded`
- `Failed`

Priority:

Medium.

## 10. Customer Dashboard Still Uses Internal Variable Name In Code And May Show Raw Statuses

File:

- `resources/js/Pages/client/ClientDashboard.jsx`

Problem:

The payment section still uses a variable named `tranches` and may display `tranche.status` directly for unsettled payments.

Why this matters:

- The variable name itself is not visible, but direct raw status display can expose inconsistent backend status values.
- Previous UI issues around tranches/payment schedule show this is a sensitive area.

Recommended fix:

Use `paymentSteps` naming in code and a display mapper for labels.

Priority:

Medium.

## 11. Some Admin Configuration Inputs Use Developer-Like Fields

File:

- `resources/js/Pages/DashboardAdmin.jsx`

Problem:

Admin forms include fields such as:

- `slug`
- `icon name`
- `image link`
- `security label`
- `applicable setup notes`

Why this may be confusing:

These are valid configuration concepts, but normal business users may not understand them without guidance.

Recommended fix:

1. Hide advanced fields under `Advanced settings`.
2. Rename fields:
   - `slug` -> `Short internal name`
   - `icon name` -> `Display icon`
   - `image link` -> `Image URL`
3. Add short helper text only where needed.

Priority:

Medium.

## 12. Demo Seeder Data Exists And Must Stay Out Of Production

File:

- `database/seeders/AnalyticsDemoSeeder.php`

Problem:

Demo analytics data exists using:

```text
demo.eloquente.test
```

Why this matters:

This is fine for development, but dangerous if seeded accidentally in production because dashboards and analytics may show fake performance.

Recommended fix:

1. Ensure demo seeder is never called by production seeders.
2. Add a clear guard that refuses to run unless `APP_ENV=local`.
3. Document this in deployment instructions.

Priority:

Medium.

## 13. Chat Staff UI Still Has Abrupt Browser Dialogs

File:

- `resources/js/Components/common/StaffMessaging.jsx`

Problem:

Staff chat uses native browser alerts/confirms for:

- claim conversation failure
- resolve conversation confirmation
- transfer failure

Why this matters:

The chat is a high-use staff tool. Abrupt browser dialogs make it feel less polished and can slow staff down.

Recommended fix:

Use branded toasts and confirmation modals.

Priority:

Medium.

## 14. Console Errors Are Still Present In Production-Bundled Frontend Code

Files:

- multiple files under `resources/js`

Problem:

Many UI files still use `console.error(...)`.

Why this matters:

Console logging is fine during development, but in production it can:

- clutter debugging
- expose internal error details in browser devtools
- make the app look unfinished when inspected

Recommended fix:

Create a small logging helper:

```js
logClientError(context, error)
```

Only log details in development, and show user-safe messages in production.

Priority:

Medium.

## Low Priority / Polish Issues

## 15. Food Tasting Language Is Repeated Across Several Interfaces

Files:

- `resources/js/Components/client/FoodTastingStep.jsx`
- `resources/js/Pages/client/FoodTasting.jsx`
- `resources/js/Pages/client\ClientDashboard.jsx`

Problem:

Food tasting explanations appear in multiple places and may drift over time.

Recommended fix:

Create shared wording constants or a shared helper component for food tasting explanation/status.

Priority:

Low.

## 16. Some Staff Empty/Error States Are Generic

Files:

- `resources/js/Pages/DashboardAdmin.jsx`
- `resources/js/Pages/DashboardAccounting.jsx`
- `resources/js/Pages/DashboardMarketing.jsx`

Problem:

Some messages still say generic phrases like:

- `Could not load...`
- `No data`
- `Failed to...`

Recommended fix:

Use role-specific empty states:

- "No bookings need review right now."
- "No payments need verification right now."
- "No refunds are waiting right now."

Priority:

Low.

## 17. Some Report/Admin Filter Inputs Still Feel Like Raw Inputs

File:

- `resources/js/Pages/DashboardAdmin.jsx`

Problem:

Some report filters use datalist-style inputs. This is better than plain text, but still not as clear as a proper searchable dropdown.

Recommended fix:

Use a shared searchable select component for known values.

Priority:

Low.

## Recommended Fix Order

## Phase 1: Payment Safety

1. Disable or replace `/api/bookings/pay`.
2. Remove or hide the legacy payment page.
3. Make manual payment proof go to Accounting review only.
4. Fix or remove broken peso symbols from legacy payment UI.

## Phase 2: Remove Unprofessional Dialogs And Raw Wording

1. Replace Marketing clarification prompt with a modal.
2. Replace native confirm/alert dialogs in staff pages.
3. Reword Admin event details labels.
4. Map raw booking validation errors to customer-friendly messages.

## Phase 3: Unify Status Display

1. Create shared booking status label mapper.
2. Create shared payment status label mapper.
3. Use these in customer, marketing, accounting, and admin pages.

## Phase 4: Production Polish

1. Guard demo seeders.
2. Centralize frontend logging.
3. Improve staff empty states.
4. Move advanced configuration fields behind progressive disclosure.

## Most Important Finding

The most urgent issue is the legacy manual payment route and page. It can still mark customer payments as verified without PayMongo or Accounting confirmation. This should be fixed before the system is used with real customers.
