# To-Do Implementation Plan

Date: 2026-05-21

This plan covers the requested feature additions and redesigns:

- A better personalized booking flow that reduces abandonment.
- A content management system for announcements on the customer home page and email.
- Post-event customer feedback collection by email and dashboard.
- Useful reports with drag-and-drop/customizable data views.
- Better analytics with real data, stronger filters, and actionable visuals.

The best implementation path is to build these in phases. The booking flow should come first because it directly affects conversions and customer experience. The CMS, feedback, reports, and analytics should then share a common reporting/data foundation so they do not become disconnected one-off screens.

## Phase 1: Booking Flow Overhaul

### Goal

Make the booking process easier, more guided, more personal, and less likely to be abandoned. The customer should feel like they are gradually building their event instead of filling out a long form.

### Current State

The booking page is currently a 6-step wizard:

1. Schedule
2. Event Type
3. Headcount
4. Menu
5. Location
6. Submit / Food Tasting

The structure works, but it can feel transactional. It also asks customers to make several decisions before they fully understand the value, pricing, or what happens next.

### Recommended New Flow

Use a more conversational step structure:

1. **Welcome / Event Vision**
   - Ask: "What are we helping you celebrate?"
   - Collect event type and optional event name.
   - Use warm copy such as: "Tell us the occasion first. We'll shape the rest around it."

2. **Date And Availability**
   - Ask for event date and preferred time.
   - Immediately show availability feedback.
   - If unavailable, suggest nearby available dates instead of only blocking progress.

3. **Guest Count And Service Style**
   - Collect pax, service preference, venue type, and basic budget comfort.
   - Show a simple estimate range early so the customer does not feel surprised later.

4. **Recommended Package**
   - Instead of forcing menu selection immediately, recommend packages based on event type, pax, and budget.
   - Allow "Use recommendation", "Compare packages", or "Customize from scratch".

5. **Menu Personalization**
   - Present menu selection as "Let's personalize your spread."
   - Use category progress: starters, mains, sides, desserts, drinks.
   - Show live total and "included vs add-on" distinction.
   - Save progress after every meaningful action.

6. **Venue And Logistics**
   - Collect contact, venue address, high-rise/outside-city logistics, setup notes.
   - Explain fees in plain language before applying them.

7. **Review Your Event Plan**
   - Show a polished summary: date, event type, pax, menu, venue, estimated total, payment schedule.
   - Use reassuring copy: "You can still refine details after submission while your date is being reviewed."

8. **Account / Submit**
   - If unauthenticated, ask the customer to create/sign in only after they have built enough of the event plan.
   - This uses the sunk cost effect ethically: the customer has already created a meaningful draft, so account creation feels like saving their plan, not a barrier.

### UX Requirements

- Add a persistent "Your event plan" side panel on desktop and collapsible summary on mobile.
- Show progress as meaningful milestones, not just numbers.
- Use encouraging microcopy after each completed step.
- Save draft automatically and show "Saved just now".
- Let users move backward freely.
- Prevent forward movement only when a required field is missing.
- Add "Not sure yet" choices for fields that can reasonably be completed later.
- Use softer validation copy:
  - Instead of "Missing Details", use "A few details are needed before we can prepare your quote."
  - Instead of "Invalid Guest Count", use "Please enter at least 20 guests so we can price the event properly."

### Technical Implementation

Create a booking flow layer instead of keeping all logic directly inside `BookingWizard.jsx`.

Recommended files:

- `resources/js/Pages/client/BookingWizard.jsx`
- `resources/js/Components/booking/BookingFlowShell.jsx`
- `resources/js/Components/booking/EventVisionStep.jsx`
- `resources/js/Components/booking/AvailabilityStep.jsx`
- `resources/js/Components/booking/GuestProfileStep.jsx`
- `resources/js/Components/booking/PackageRecommendationStep.jsx`
- `resources/js/Components/booking/MenuPersonalizationStep.jsx`
- `resources/js/Components/booking/LogisticsStep.jsx`
- `resources/js/Components/booking/ReviewSubmitStep.jsx`
- `resources/js/hooks/useBookingDraft.js`
- `resources/js/hooks/useBookingPricingPreview.js`

Backend/API additions:

- `POST /api/bookings/pricing-preview`
  - Accept partial booking draft.
  - Return estimated price range, fees, suggested package, and payment schedule preview.
- `GET /api/bookings/available-suggestions?date=YYYY-MM-DD`
  - Return nearby available dates when selected date is unavailable.
- `POST /api/booking-drafts`
  - Optional server-side draft persistence for authenticated users.
- `PATCH /api/booking-drafts/{id}`
  - Save progress server-side.

Database additions:

- `booking_drafts`
  - `id`
  - `user_id` nullable
  - `guest_token` nullable for pre-login drafts
  - `current_step`
  - `draft_data` JSON
  - `last_completed_step`
  - `expires_at`
  - timestamps

### Abandonment Reduction Features

- Save draft before registration.
- Email a "Finish your event plan" reminder if the user created an account but did not submit.
- Show "You are 70% done" after menu or logistics.
- Show a polished event summary before account creation.
- Offer live chat/help from the wizard.
- Track analytics events:
  - `booking_started`
  - `booking_step_completed`
  - `booking_abandoned`
  - `booking_resumed`
  - `booking_submitted`

### Acceptance Criteria

- A new customer can build a draft before creating an account.
- Returning customers can resume their last draft.
- The wizard shows a clear event summary at every step.
- Pricing preview comes from the backend, not only frontend calculations.
- Mobile layout is easy to complete with no overlapping controls.
- Build passes and booking submission still creates correct payment schedules.

## Phase 2: Announcement CMS

### Goal

Allow Marketing/Admin users to create announcements that can appear on the customer home page/dashboard and be sent by email.

### User Roles

- Admin:
  - Full create, edit, approve, publish, archive, delete.
- Marketing:
  - Create, edit, schedule, publish if allowed by policy.
- Customer:
  - View targeted announcements.

### Content Types

- General announcement
- Promo
- Event reminder
- Holiday advisory
- Menu update
- Service notice
- Urgent notice

### Database Design

Create these tables:

#### `announcements`

- `id`
- `title`
- `slug`
- `summary`
- `body`
- `type`
- `status` (`draft`, `scheduled`, `published`, `archived`)
- `visibility` (`all_customers`, `active_clients`, `specific_roles`, `specific_users`)
- `starts_at`
- `ends_at`
- `published_at`
- `created_by`
- `updated_by`
- `approved_by` nullable
- `send_email`
- `email_subject`
- `email_body`
- `cta_label`
- `cta_url`
- `image_path` nullable
- timestamps

#### `announcement_recipients`

- `id`
- `announcement_id`
- `user_id`
- `email`
- `status` (`pending`, `sent`, `failed`, `opened`, `clicked`)
- `sent_at`
- `opened_at`
- `clicked_at`
- timestamps

#### `announcement_reads`

- `id`
- `announcement_id`
- `user_id`
- `read_at`
- timestamps

### Backend Implementation

Routes:

- `GET /api/admin/announcements`
- `POST /api/admin/announcements`
- `GET /api/admin/announcements/{announcement}`
- `PATCH /api/admin/announcements/{announcement}`
- `POST /api/admin/announcements/{announcement}/publish`
- `POST /api/admin/announcements/{announcement}/archive`
- `POST /api/admin/announcements/{announcement}/send-test`
- `GET /api/customer/announcements`
- `POST /api/customer/announcements/{announcement}/read`

Services:

- `AnnouncementService`
  - Validates publishing rules.
  - Resolves recipients.
  - Queues email delivery.
  - Tracks read/send state.

Notifications/Mail:

- `AnnouncementEmail`
- Queue all email sends.
- Add preview/test-send support before publishing.

### UI Implementation

Admin/Marketing dashboard:

- Add a new tab: `Content`
- Sub-tabs:
  - Announcements
  - Drafts
  - Scheduled
  - Sent history
- Provide a composer with:
  - Title
  - Announcement type
  - Audience selector
  - Rich text body
  - CTA button
  - Optional image
  - Publish now / schedule
  - Send email toggle
  - Email preview

Customer home/dashboard:

- Add an announcement banner/card section.
- Support dismiss/read state.
- Show urgent announcements more prominently.

### Acceptance Criteria

- Marketing/Admin can create draft announcements.
- Announcements can be published immediately or scheduled.
- Published announcements appear for the correct customers.
- Email sends are queued and tracked.
- Customers can dismiss/read announcements.
- Admin can see sent, failed, read, and clicked counts.

## Phase 3: Customer Feedback System

### Goal

Collect structured feedback from customers after their event and allow staff/admin to review satisfaction trends.

### Trigger Timing

Send feedback request automatically:

- 1 day after completed event, or
- when Marketing/Admin marks the booking as `Completed`.

### Database Design

Create these tables:

#### `feedback_requests`

- `id`
- `booking_id`
- `user_id`
- `token`
- `status` (`pending`, `sent`, `completed`, `expired`)
- `sent_at`
- `completed_at`
- `expires_at`
- timestamps

#### `feedback_responses`

- `id`
- `feedback_request_id`
- `booking_id`
- `user_id`
- `overall_rating`
- `food_rating`
- `service_rating`
- `communication_rating`
- `value_rating`
- `would_recommend`
- `favorite_part`
- `improvement_notes`
- `testimonial_permission`
- `public_testimonial`
- timestamps

### Backend Implementation

Routes:

- `GET /feedback/{token}`
- `POST /feedback/{token}`
- `GET /api/admin/feedback`
- `GET /api/marketing/feedback`
- `POST /api/admin/feedback/{response}/feature`

Jobs:

- `SendFeedbackRequestJob`
- `ExpireFeedbackRequestsJob`

Notifications/Mail:

- `FeedbackRequestEmail`

### UI Implementation

Customer feedback form:

- Mobile-first.
- Star ratings or segmented controls.
- Short optional text fields.
- Thank-you screen after submission.

Admin/Marketing dashboard:

- Feedback tab or card in Reports/Analytics.
- Filters by date range, package, event type, rating, staff member, and status.
- Show low-rating alerts.
- Allow approved testimonials to be reused on marketing pages later.

### Acceptance Criteria

- Completed bookings receive one feedback request.
- Feedback link works without requiring login but uses secure token.
- Token expires after a defined period.
- Staff can view feedback by booking/customer.
- Analytics can use feedback scores.

## Phase 4: Reports Builder With Drag-And-Drop

### Goal

Turn the Reports tab into a useful custom report builder where Admin can choose data blocks, arrange them, filter them, and export results.

### Recommended Approach

Start with a controlled report builder instead of a full arbitrary BI tool. The admin should be able to mix and match approved data widgets without creating unsafe raw SQL queries.

### Report Builder Concepts

Report widgets:

- Revenue summary
- Payment status breakdown
- Outstanding balances
- Booking pipeline
- Event calendar/load
- Package performance
- Menu item performance
- Customer growth
- Repeat customers
- Refunds and cancellations
- Feedback ratings
- Staff activity/audit summary

Drag-and-drop layout:

- Use a library such as `@dnd-kit/core` for drag-and-drop.
- Optional later: `react-grid-layout` for resizable dashboard tiles.

### Database Design

#### `report_templates`

- `id`
- `name`
- `description`
- `created_by`
- `visibility` (`private`, `admin`, `all_staff`)
- `layout_json`
- `filters_json`
- timestamps

#### `report_runs`

- `id`
- `report_template_id`
- `created_by`
- `status`
- `parameters_json`
- `result_snapshot_json`
- `export_path` nullable
- timestamps

### Backend Implementation

Routes:

- `GET /api/admin/report-widgets`
- `POST /api/admin/report-preview`
- `GET /api/admin/report-templates`
- `POST /api/admin/report-templates`
- `PATCH /api/admin/report-templates/{template}`
- `DELETE /api/admin/report-templates/{template}`
- `POST /api/admin/report-templates/{template}/run`
- `GET /api/admin/report-runs/{run}`
- `GET /api/admin/report-runs/{run}/export`

Services:

- `ReportWidgetRegistry`
  - Defines allowed widgets and their required data.
- `ReportQueryService`
  - Runs safe aggregate queries.
- `ReportExportService`
  - Exports CSV first, PDF later.

### UI Implementation

Reports tab layout:

- Left panel: available widgets.
- Center canvas: drag-and-drop report layout.
- Right panel: selected widget configuration.
- Top bar:
  - Date range
  - Event type
  - Package
  - Status
  - Payment status
  - Save template
  - Run report
  - Export

Widget configuration examples:

- Revenue summary:
  - Date basis: event date / booking created date / payment date
  - Metric: gross revenue / settled revenue / pending revenue
- Booking pipeline:
  - Group by status / event type / month
- Menu performance:
  - Group by category / item
  - Sort by orders / pax served / revenue contribution

### Acceptance Criteria

- Admin can drag widgets into a report canvas.
- Admin can reorder widgets.
- Admin can apply global filters.
- Admin can configure individual widgets.
- Admin can save and reload a report template.
- Admin can export at least CSV in the first release.

## Phase 5: Analytics Redesign

### Goal

Make analytics based on real database facts, remove misleading future/simulated data, add filters, and make every visual answer an operational question.

### Current Problem

Current analytics includes forecast-style visuals such as `Revenue Forecast (H2 2026)` and projected-looking data. Some of it is based on averages or upcoming events rather than confirmed real outcomes. This can confuse users if the chart looks like actual future revenue.

### Analytics Principles

- Separate actuals, pipeline, and forecast clearly.
- Default to actual completed/paid data.
- Label pending bookings as pipeline, not revenue.
- Label estimates as estimates.
- Allow date basis selection:
  - Booking created date
  - Event date
  - Payment paid date
- Every chart should have an action implication.

### Core Filters

Global filters:

- Date range
- Date basis
- Event type
- Package
- Booking status
- Payment status
- Customer type: new / returning
- Location/city
- Pax range
- Price range

### Recommended Analytics Sections

#### 1. Revenue Health

Questions answered:

- How much money has actually been collected?
- How much is still pending?
- How much is overdue?

Visuals:

- Settled revenue over time.
- Pending vs overdue payment bars.
- Collection rate percentage.
- Average booking value.

Data source:

- `payments` table for settled revenue.
- `bookings` table for booking value and status.

#### 2. Booking Pipeline

Questions answered:

- How many events are pending approval?
- How many upcoming confirmed events need attention?
- Where do bookings stall?

Visuals:

- Funnel: inquiry/draft/submitted/approved/confirmed/completed/cancelled.
- Upcoming event workload calendar.
- Pending approvals by age.

Data source:

- `bookings`
- future `booking_drafts` if implemented.

#### 3. Menu And Package Performance

Questions answered:

- Which packages sell most?
- Which dishes are selected most?
- Which menu categories drive add-ons?

Visuals:

- Top packages by booking count and revenue.
- Top menu items by selections and pax served.
- Category mix.

Data source:

- `bookings`
- `booking_items`
- `menu_items`
- `packages`

#### 4. Customer Experience

Questions answered:

- Are customers satisfied after events?
- Which event types receive lower ratings?
- What feedback should staff act on?

Visuals:

- Average rating over time.
- Rating by event type/package.
- Low-rating alert list.
- Recommendation rate.

Data source:

- future `feedback_responses`
- `bookings`

#### 5. Operations And Capacity

Questions answered:

- Which months/days are busiest?
- Are there risky overbooked periods?
- Which cities or venue types create more logistics cost?

Visuals:

- Event heatmap by day/month.
- Pax load by date.
- Location/city distribution.
- High-rise/outside-city surcharge totals.

Data source:

- `bookings`

### Backend Implementation

Replace one broad `/api/admin/analytics` response with a filterable endpoint design:

- `GET /api/admin/analytics/summary`
- `GET /api/admin/analytics/revenue`
- `GET /api/admin/analytics/pipeline`
- `GET /api/admin/analytics/menu-performance`
- `GET /api/admin/analytics/customer-experience`
- `GET /api/admin/analytics/operations`

Each endpoint should accept:

- `date_from`
- `date_to`
- `date_basis`
- `event_type`
- `package_id`
- `booking_status`
- `payment_status`
- `city`
- `pax_min`
- `pax_max`

Implementation notes:

- Use real aggregate SQL queries.
- Cache each query by filter hash for 30-120 seconds.
- Do not include demo/future data in production analytics.
- Keep forecast as a separate optional feature labeled "Estimate" and only show when there is enough historical data.

### Frontend Implementation

Admin analytics tab:

- Add a sticky filter bar.
- Add clear labels:
  - Actual collected
  - Pending pipeline
  - Overdue risk
  - Estimated only if applicable
- Add empty states that explain when there is not enough data.
- Add chart subtitles explaining what action to take.

Example chart copy:

- "Overdue balances by age: prioritize the oldest unpaid tranches first."
- "Pending approvals older than 48 hours: follow up before customers abandon."
- "Top dishes by pax served: use these for package recommendations."

### Acceptance Criteria

- Analytics defaults to real completed/paid/current data.
- Future values are not shown as actual revenue.
- Filters update all charts consistently.
- Empty states are honest and useful.
- Charts match the database when manually checked.

## Cross-Feature Foundation

### Shared Data Definitions

Create a small analytics/reporting domain layer so reports and analytics use the same definitions.

Recommended services:

- `AnalyticsFilterService`
- `AnalyticsQueryService`
- `ReportWidgetRegistry`
- `DateBasisResolver`

Shared definitions:

- Settled revenue = payments with status `Paid` or `Verified`.
- Pending revenue = unpaid non-refunded payment milestones.
- Pipeline value = bookings not completed/cancelled with unpaid or future event value.
- Actual event count = completed or confirmed events depending on selected date basis.

### Permissions

Use role policies:

- Admin:
  - Full analytics, reports, CMS, feedback.
- Marketing:
  - CMS create/edit, booking/customer feedback visibility, limited reports.
- Accounting:
  - Payment/refund/revenue reports, no content publishing unless allowed.
- Client:
  - Only their announcements, feedback forms, booking state.

### Auditing

Audit these actions:

- Announcement publish/archive/delete.
- Bulk email send.
- Feedback featured/testimonial approval.
- Report export.
- Saved report template creation/update/delete.
- Analytics export/download.

## Suggested Build Order

1. Redesign booking flow information architecture and copy.
2. Implement booking pricing preview endpoint and draft persistence.
3. Build new booking UI components step by step.
4. Add announcement CMS database tables and backend.
5. Add announcement UI in Admin/Marketing dashboard and customer display.
6. Add queued announcement email delivery.
7. Add feedback request tables, email, public form, and dashboard review.
8. Build analytics filter services and replace misleading forecast visuals.
9. Build report widget registry and basic report preview endpoint.
10. Add drag-and-drop report builder UI.
11. Add saved templates and export.
12. Add tests and staging QA for all flows.

## Testing Plan

### Booking

- Draft starts before login.
- Draft resumes after registration/login.
- Pricing preview matches final booking total.
- Rush booking payment schedule remains correct.
- Customer can submit booking on desktop and mobile.

### Announcements

- Admin/Marketing can create draft.
- Scheduled announcements publish at the correct time.
- Audience filters work.
- Emails are queued and sent.
- Customer read/dismiss state works.

### Feedback

- Feedback email sends after completed event.
- Token link works without login.
- Duplicate submission is blocked.
- Expired token is rejected.
- Admin can filter feedback.

### Reports

- Widgets can be dragged/reordered.
- Filters affect preview data.
- Saved templates reload correctly.
- CSV export matches filtered data.

### Analytics

- Filters produce correct database-backed results.
- Future/pipeline values are clearly labeled.
- Empty states show when no data exists.
- Demo seed data does not appear in production unless explicitly seeded in a local/demo environment.

## Final Recommendation

Do not build all five areas as separate isolated features. Treat them as one improvement program:

- Booking flow creates better structured data.
- CMS and feedback improve customer communication.
- Feedback feeds analytics.
- Analytics and reports share the same query/filter foundation.
- Reports become a flexible view over the same trusted data definitions.

This keeps the system easier to maintain and makes the admin dashboard feel like one coherent operations tool instead of several unrelated tabs.

