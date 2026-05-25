# May 25 Summary Report

Created: 2026-05-25

## Purpose

This report summarizes the major changes completed on May 25 for the Eloquente Catering system. It is meant as a handoff reference for the team so everyone can understand what changed, why it changed, and what should be tested next.

## High-Level Summary

Today's work focused on making the system feel more like a real business operations platform instead of separate customer and staff screens.

The biggest improvements were:

- clearer customer-to-staff booking handoff
- Marketing booking intake workflow
- customer clarification request and response flow
- staff review checklist per booking
- better staff workflow planning documents
- production and workflow guidance documents
- GitHub updates for the latest working state

## Documents Created Or Updated

## `newsuggestionsplan.md`

Created a full customer-to-admin workflow analysis and implementation plan.

It covers:

- customer discovery
- booking submission
- Marketing review
- Accounting payment handling
- PayMongo reconciliation
- food tasting workflow
- event preparation
- event completion
- feedback
- refunds
- reports and analytics
- role responsibilities
- UI/UX consistency rules

## `toaddafter.md`

Created a follow-up roadmap for features that should be considered after the workflow foundation is stable.

It includes:

- customer profile history
- repeat customer offers
- saved customer preferences
- staff and crew scheduling
- equipment and amenities inventory
- kitchen production planning
- delivery planning
- invoices and receipts
- VAT reporting
- expense tracking
- approval rules

## `instructions.md`

Created a step-by-step guide for testing the whole business workflow.

It explains how to test:

1. Customer creates a booking.
2. Customer dashboard shows the booking status.
3. Marketing claims and reviews the booking.
4. Marketing requests customer details.
5. Customer responds from the dashboard.
6. Marketing approves the booking.
7. Customer pays through PayMongo.
8. Accounting verifies payments and refunds.
9. Marketing/Admin prepare the event.
10. Admin supervises the overall operation.

## Backend Workflow Changes

## Booking Review Fields

Added workflow fields to bookings so staff can track review state more clearly:

- `review_status`
- `assigned_to`
- `clarification_request`
- `clarification_response`
- `clarification_requested_at`
- `clarification_responded_at`
- `reviewed_at`

Reason:

Bookings need more than a basic status. Staff need to know whether a booking is submitted, under review, waiting for customer details, approved, cancelled, or completed.

## Booking Review Tasks

Added a new `booking_review_tasks` table and model.

Each submitted booking now receives default checklist tasks:

- Confirm date and capacity
- Review package and menu fit
- Check venue location and access
- Confirm payment schedule
- Check tasting preference

Reason:

Marketing staff should not review bookings from memory. The checklist makes the intake process repeatable.

## Booking Submission Security

Adjusted booking creation so the authenticated user is used as the booking owner instead of trusting a submitted `user_id`.

Reason:

Customers should not be able to submit a booking under another user's account by changing request data.

## Customer Clarification Flow

Added a backend endpoint for customers to respond to staff clarification requests.

Customer response updates:

- `clarification_response`
- `clarification_responded_at`
- `review_status` to `Clarification Received`
- the related visible clarification task

Reason:

If staff need missing details, the customer should answer inside the system instead of relying only on chat or manual follow-up.

## Marketing Workflow Changes

## Booking Assignment

Marketing can now claim a booking.

Claiming a booking:

- assigns the booking to the current Marketing staff user
- moves a submitted booking into `Under Review`

Reason:

Unassigned bookings are easy to miss. Ownership makes it clear who is responsible.

## Review Status Updates

Marketing can now manage review states more explicitly:

- Submitted
- Under Review
- Needs Customer Details
- Clarification Received
- Approved For Reservation
- Not Available
- Completed

Reason:

These statuses better match the real business process than only using `Pending`, `Confirmed`, or `Cancelled`.

## Request Details From Customer

Marketing can request missing customer details from a booking.

This:

- stores the staff message
- marks the booking as `Needs Customer Details`
- creates a customer-visible clarification task
- notifies the customer

Reason:

The system now supports a structured staff-to-customer handoff instead of informal follow-up.

## Review Checklist Interaction

Marketing can mark booking review checklist tasks as done or pending.

Reason:

This gives staff a guided review process before approving a booking for payment.

## Marketing UI Changes

Updated the Marketing booking review area to work more like an intake queue.

Changes include:

- clearer booking intake language
- booking owner display
- review status display
- `Claim` action
- `Ask details` action
- customer response visibility
- review checklist panel inside booking details
- status update now merges the returned booking into the UI immediately

Reason:

Marketing should immediately know which bookings need attention and what action is needed next.

## Customer Dashboard Changes

Added a customer-facing clarification panel.

When staff request details, the customer dashboard now shows:

- the staff request
- a text area for response
- send response button
- response sent confirmation

The journey tracker also includes a staff request step when clarification is needed.

Reason:

Customers should not have to guess why their booking is waiting. The dashboard now shows the exact next action.

## Admin Data Changes

Admin booking data now includes workflow fields:

- review status
- assigned staff
- clarification request/response
- review timestamps
- review tasks

Reason:

Admin needs visibility into handoffs and bottlenecks without taking over every staff task.

## Routes Added

Customer:

- `POST /api/bookings/{id}/clarification-response`

Marketing:

- `PUT /api/marketing/bookings/{id}/assign`
- `PUT /api/marketing/bookings/{id}/review-status`
- `POST /api/marketing/bookings/{id}/clarification`
- `PATCH /api/marketing/bookings/{bookingId}/review-tasks/{taskId}`

## Validation And Verification

The following checks passed:

- PHP syntax checks for new and modified backend files
- Laravel migration check
- frontend production build
- Laravel test suite
- Git diff whitespace check

Commands used:

```bash
.\php\php.exe artisan migrate
npm.cmd run build
.\php\php.exe artisan test
git diff --check
```

## GitHub Update

Earlier May 25 work was already committed and pushed with:

```text
72fcd80 Improve staff workflows and performance planning
```

This summary report and the booking workflow implementation are prepared to be committed and pushed as the next update.

## What To Test Next

Test the workflow using `instructions.md`.

Priority tests:

1. Customer submits a new booking.
2. Marketing sees it in booking intake.
3. Marketing claims the booking.
4. Marketing requests missing details.
5. Customer sees the request in dashboard.
6. Customer responds.
7. Marketing sees the response.
8. Marketing approves the booking.
9. Customer can proceed to payment.
10. Accounting can verify payment/refund states.

## Known Remaining Larger Work

The foundation is now in place, but these larger workflow phases still deserve future dedicated passes:

- full Accounting Today queue
- payment exception records
- refund case records
- event preparation board
- internal event preparation tasks
- event sheet export
- post-event feedback system
- low-rating alerts
- testimonial approval
- repeat customer tracking

These are intentionally listed in `toaddafter.md` so they can be implemented after the new booking handoff workflow is stable.
