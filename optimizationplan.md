# ECS Optimization Plan

Created: 2026-05-20

## Implementation Pass Completed

Completed on 2026-05-20:

- Production `.env.example` defaults were changed away from local/debug/database-backed settings and real-looking secrets were replaced with placeholders.
- The shared logo asset was resized from a 4000x4000 PNG at about 6.26 MB to a 512x512 PNG at about 182 KB.
- Client dashboard loading no longer performs PayMongo checkout reconciliation as part of the normal dashboard API response.
- Accounting payment verification now uses server-side search, payment-status filtering, sorting, and pagination with 25 bookings per page.
- Admin and accounting list APIs now select slimmer booking/payment columns for list views.
- New dashboard-focused database indexes were added and migrated.
- Booking availability checks were changed from `whereDate` wrappers to index-friendlier range comparisons.
- Staff dashboard smart-refresh intervals were reduced from 30-45 seconds to 90-120 seconds.
- Booking wizard draft persistence is debounced to reduce localStorage write pressure.
- Menu API helper calls are cached in-session to avoid duplicate catalog fetches.

## Executive Summary

The site is slow mainly because large dashboard APIs return full datasets, the frontend repeatedly refetches and reprocesses those datasets during tab changes and smart refresh cycles, and the marketing/client pages load many large remote images. The build itself is already code-split by page, but the biggest runtime cost is still the combination of oversized API payloads, client-side filtering/pagination, image downloads, and synchronous network work during payment/dashboard flows.

The highest-impact fixes are:

1. Add server-side pagination, filtering, and slim response serializers for admin, marketing, accounting, and client dashboard APIs.
2. Stop syncing PayMongo checkout status inside normal dashboard loads; move it to webhooks, queued jobs, or a targeted status endpoint.
3. Replace oversized and remote images with local optimized WebP/AVIF variants, lazy loading, explicit dimensions, and preloaded critical hero/logo assets.
4. Reduce dashboard polling and only refresh small deltas or the active panel.
5. Move heavy frontend list work to memoized selectors, virtualized lists, and tab-level lazy components.
6. Use production cache/session/queue settings: Redis or another low-latency store, optimized Laravel config/routes/views, OPcache, compression, and CDN caching.

## Evidence From Code Review

### Build and Asset Evidence

- Production build completed, but several chunks are large:
  - `ui`: about 392.70 KB raw, 116.10 KB gzip.
  - `inertia`: about 311.94 KB raw, 99.00 KB gzip.
  - `app`: about 131.57 KB raw, 43.28 KB gzip.
  - `DashboardAdmin`: about 104.56 KB raw, 19.90 KB gzip.
  - `BookingWizard`: about 107.21 KB raw, 24.47 KB gzip.
  - `DashboardMarketing`: about 65.31 KB raw, 14.97 KB gzip.
  - `ClientDashboard`: about 59.50 KB raw, 14.28 KB gzip.
- `resources/images/ECS_LOGO.png` is 6,265,905 bytes. This is extremely large for a logo and is bundled into `public/build/assets/ECS_LOGO-*.png`, making first loads and repeated logo usage expensive.
- Many pages directly load Unsplash URLs. Examples:
  - `resources/js/Pages/LandingPage.jsx`
  - `resources/js/Pages/About.jsx`
  - `resources/js/Pages/Amenities.jsx`
  - `resources/js/Pages/client/ClientOverview.jsx`
  - Menu item fallbacks in menu builder/gallery/dashboard components.
- Most `<img>` tags do not consistently use `loading="lazy"`, `decoding="async"`, width/height/aspect-ratio, or a shared optimized image component.

### Backend/API Evidence

Several high-traffic endpoints return full tables or large joined datasets using `.get()`:

- `AccountingController::getBookingsWithPayments()`
  - Loads all non-cancelled/non-pending bookings with all payment rows.
  - Frontend then searches, filters, sorts, and switches list/card view client-side.
- `AccountingController::getLedger()`
  - Loads all matching payments with booking/user data and then the frontend groups them client-side.
  - Has status/date filters server-side, but client search and package filtering are still client-side.
- `MarketingController::getAllBookings()`
  - Loads all bookings with user details for calendar, inquiries, documents, summaries, and exports.
  - Dashboard does repeated `.filter()` operations over the full list.
- `AdminController::getBookings()`
  - Loads all active bookings with payments and users, then the frontend performs search, status filtering, sorting, and pagination.
- `AdminController::getEmployees()` and `AdminController::getCustomers()`
  - Customers uses counts, but still returns the full client list.
- `ClientDashboardController::apiData()`
  - Loads all bookings for the user, all tastings, all payments, maps each booking, and computes several service values per booking.
  - Calls `syncPendingTranches()` for every booking on every dashboard load.
  - Calls `syncPendingPayMongoCheckouts()`, which can make PayMongo API calls during a normal dashboard fetch.

### Database Evidence

There are useful indexes already:

- `bookings.user_id`
- `bookings.event_date`
- `bookings.status`
- `payments.booking_id`
- `payments.status`
- Composite indexes such as `bookings_status_event_date_idx`, `bookings_status_package_id_idx`, `payments_status_due_date_idx`, `users_role_created_at_idx`.

Remaining database concerns:

- Several queries filter with `whereDate(event_date, ...)`, which can prevent index-friendly range scans depending on database and SQL generated.
- Some common access patterns need better composite indexes:
  - Client dashboard: `(user_id, status, event_date)`.
  - Accounting payment schedule: `(booking_id, status, payment_type, due_date)`.
  - Ledger: `(status, created_at)` and possibly `(booking_id, created_at)`.
  - PayMongo sync/webhook lookup: `paymongo_checkout_session_id`, `paymongo_payment_id`, `paymongo_event_id`.
  - Chat/messages/notifications: `(user_id, read_at/created_at)` or equivalent unread-count indexes.
- Large JSON/text columns such as `selected_menu`, `theme_uploads`, `outsourced_services`, and `event_timeline` are included when `toArray()` is returned, even when list screens only need summary fields.
- Database-backed sessions, cache, and queues are configured in `.env.example`. That is acceptable for development, but it increases database traffic and contention in production compared with Redis.

### Frontend Rendering Evidence

Large page files:

- `DashboardAdmin.jsx`: 2,475 lines, about 197 KB source.
- `ClientDashboard.jsx`: 1,249 lines, about 122 KB source.
- `DashboardMarketing.jsx`: 1,372 lines, about 94 KB source.
- `DashboardAccounting.jsx`: 831 lines, about 68 KB source.
- `BookingWizard.jsx`: 631 lines, about 37 KB source.
- `MenuBuilder.jsx`: 707 lines, about 49 KB source.

Rendering and client-side compute issues:

- Admin dashboard fetches whole datasets, then performs search/filter/sort/paginate in React.
- Marketing dashboard repeatedly filters the full booking array for calendar cells, inquiries, documents, summaries, and PDF export.
- Accounting dashboard filters, searches, sorts, groups ledger rows, and calculates totals in React.
- Client dashboard repeatedly filters all payments by active booking and maps nested menu selections.
- Booking wizard stores draft data to localStorage on every change. That is useful, but it should be debounced because large selected menu data can make frequent synchronous writes.
- Smart refresh runs every 30-45 seconds on several dashboards and refetches full datasets. It is idle-aware, but the payloads are still too large.

### External Network and Payment Flow Evidence

- PayMongo calls use a 20-second timeout.
- `ClientDashboardController::apiData()` may retrieve PayMongo checkout sessions while loading the dashboard.
- `PaymentController::success()` also retrieves PayMongo checkout status synchronously after redirect.
- Refund processing loops through paid payments and calls PayMongo sequentially. This can be slow and should be queued for larger/multiple refunds.

### Configuration and Deployment Concerns

- `.env.example` currently contains real-looking database and mail credentials. This is a security problem and also makes environment setup risky. It should contain placeholders only.
- `.env.example` has `APP_ENV=local`, `APP_DEBUG=true`, `CACHE_STORE=database`, `SESSION_DRIVER=database`, and `QUEUE_CONNECTION=database`. Production should use `APP_ENV=production`, `APP_DEBUG=false`, Redis cache/session/queue, OPcache, and optimized Laravel config.
- Vite manual chunking creates a zero-byte `vendor` chunk because React 19/dependencies are split differently. The current split is not fatal, but chunk strategy should be tuned after bundle analysis.

## Root Causes of Slow Page Changes

1. **Full-table API payloads.** Inertia page changes are code-split, but after navigation the page immediately fetches APIs that return full lists.
2. **Client-side filtering/pagination.** The browser does work that should happen in SQL: search, sorting, grouping, filtering, pagination.
3. **Repeated refresh of large payloads.** Smart refresh refetches full lists, so an idle dashboard becomes expensive every 30-45 seconds.
4. **Large images and remote image waterfalls.** The 6.26 MB logo and many Unsplash images delay rendering and increase bandwidth.
5. **Synchronous third-party calls in page load paths.** PayMongo status checks inside dashboard/success flows can hold up user-facing requests.
6. **Production config not tuned.** Database-backed cache/session/queue and debug/local-style config make the database do extra work.

## Prioritized Fix Plan

### Phase 0: Measure Before Changing

Goal: establish a repeatable baseline.

Actions:

- Add Laravel Telescope or a lightweight query logger in local/staging only.
- Add browser performance traces for:
  - `/`
  - `/book`
  - `/dashboard/client`
  - `/dashboard/admin`
  - `/dashboard/marketing`
  - `/dashboard/accounting`
- Capture:
  - TTFB per route.
  - API response size.
  - API duration.
  - SQL query count and slowest queries.
  - JS chunk download/parse time.
  - Largest Contentful Paint image.
  - Total transferred image bytes.

Acceptance target:

- Know the top 10 slowest endpoints and top 10 largest assets before implementation begins.

### Phase 1: Production Configuration Quick Wins

Goal: remove avoidable framework and infrastructure drag.

Actions:

- Change production env to:
  - `APP_ENV=production`
  - `APP_DEBUG=false`
  - `LOG_LEVEL=warning`
  - `CACHE_STORE=redis`
  - `SESSION_DRIVER=redis`
  - `QUEUE_CONNECTION=redis`
- Keep database cache/session/queue only for development.
- Run on deploy:
  - `php artisan optimize`
  - `php artisan config:cache`
  - `php artisan route:cache`
  - `php artisan view:cache`
  - `composer install --no-dev --optimize-autoloader`
  - `npm run build`
- Enable PHP OPcache in production.
- Enable gzip or Brotli compression at the web server/CDN.
- Remove real secrets from `.env.example` and replace with placeholders.

Acceptance target:

- Page TTFB drops without code behavior changes.
- No production debug stack traces.
- Static assets are compressed and long-cacheable.

### Phase 2: Image Optimization

Goal: reduce visual payload and avoid image-driven layout/render delays.

Actions:

- Replace `resources/images/ECS_LOGO.png` with optimized variants:
  - SVG if possible for logo.
  - Otherwise WebP/PNG at actual rendered sizes.
  - Target under 100 KB for standard logo, under 250 KB for large auth logo.
- Convert `ECS_LOGO_AUTH.png` to WebP if transparency/quality allows.
- Replace direct Unsplash use with curated local assets or CDN-hosted transformed images.
- Add `loading="lazy"` and `decoding="async"` to non-hero images.
- Add `fetchpriority="high"` only to the first hero image.
- Add explicit width/height or stable aspect-ratio to every image slot.
- Use `OptimizedImage` consistently in:
  - Landing page
  - Amenities/About pages
  - Menu gallery
  - Menu builder
  - Client dashboard menu cards
  - Admin/marketing menu item thumbnails
- Generate responsive sizes:
  - hero: 640, 960, 1280, 1600
  - cards: 320, 480, 640
  - thumbnails: 96, 160, 240

Acceptance target:

- Initial home page image transfer under 700 KB on desktop and under 450 KB on mobile.
- Logo transfer under 100 KB.
- No layout shift from images.

### Phase 3: API Pagination, Slim Payloads, and Server-Side Filters

Goal: stop sending entire datasets to every dashboard.

Actions by endpoint:

- `GET /api/admin/bookings`
  - Accept `page`, `per_page`, `search`, `status`, `sort`.
  - Return paginated results.
  - Select only list fields.
  - Load details/payments only when a booking modal opens.
- `GET /api/admin/customers`
  - Add `page`, `per_page`, `search`, `sort`.
  - Keep `withCount`/`withMax`, but paginate.
- `GET /api/admin/employees`
  - Paginate or cap if staff count can grow.
- `GET /api/admin/audits`
  - Already paginated server-side. Connect the existing frontend filters to query params instead of filtering a 100-row payload in React.
- `GET /api/marketing/bookings`
  - Split into purpose-specific endpoints:
    - `/api/marketing/calendar?month=YYYY-MM`
    - `/api/marketing/inquiries?page=...`
    - `/api/marketing/documents?from=...&to=...`
    - `/api/marketing/bookings/{id}` for detail modal.
  - Keep export endpoint server-side so PDF/export does not require loading all bookings in the browser.
- `GET /api/accounting/bookings`
  - Accept `page`, `per_page`, `search`, `payment_status`, `sort`.
  - Return only current page.
  - Include summary counts separately.
- `GET /api/accounting/ledger`
  - Accept `page`, `per_page`, `search`, `package`, `status`, `startDate`, `endDate`.
  - Group server-side by booking or return flat paginated rows, not all rows.
- `GET /api/dashboard/client`
  - Split into:
    - `/api/dashboard/client/summary`
    - `/api/dashboard/client/bookings`
    - `/api/dashboard/client/bookings/{id}`
    - `/api/dashboard/client/payments?booking_id=...`
    - `/api/dashboard/client/tastings`
  - Initial dashboard should load only booking list summaries and active booking detail.

Serializer rules:

- Never use raw `$model->toArray()` for list endpoints.
- Create Laravel API Resources or explicit arrays for each list/detail shape.
- Exclude heavy fields from list views:
  - `selected_menu`
  - `theme_uploads`
  - `event_timeline`
  - `special_instructions`
  - long venue text unless needed.

Acceptance target:

- Dashboard list endpoints return under 100 KB for normal pages.
- Initial dashboard API calls complete under 300 ms server time on production data.
- Frontend no longer performs primary pagination of large backend tables.

### Phase 4: Database Query and Index Improvements

Goal: make the new server-side filters fast.

Actions:

- Replace `whereDate(event_date, $date)` with range queries:
  - `where('event_date', '>=', $dateStart)`
  - `where('event_date', '<', $dateEnd)`
- Add or confirm indexes:
  - `bookings_user_status_event_date_idx` on `(user_id, status, event_date)`.
  - `bookings_user_event_date_idx` on `(user_id, event_date)`.
  - `bookings_status_created_at_idx` on `(status, created_at)`.
  - `payments_booking_status_type_due_idx` on `(booking_id, status, payment_type, due_date)`.
  - `payments_status_created_at_idx` on `(status, created_at)`.
  - `payments_paymongo_checkout_session_id_idx` on `(paymongo_checkout_session_id)`.
  - `payments_paymongo_payment_id_idx` on `(paymongo_payment_id)`.
  - `payments_paymongo_event_id_idx` on `(paymongo_event_id)`.
  - `notifications_notifiable_read_idx` on notification ownership/read fields.
  - `messages_conversation_created_idx` on `(conversation_id, created_at)`.
- Add database-level uniqueness/idempotency where relevant:
  - PayMongo event IDs should not process twice.
  - One active payment schedule row per booking/payment type when appropriate.
- Use `EXPLAIN ANALYZE` on:
  - dashboard client bookings
  - admin bookings
  - marketing calendar
  - accounting ledger
  - disabled dates
  - unread notification/message counts

Acceptance target:

- Main list queries use index scans or efficient bitmap index scans.
- No dashboard endpoint performs full table scans on production-sized data.

### Phase 5: PayMongo and Notification Flow Optimization

Goal: remove third-party latency from normal page rendering.

Actions:

- Treat PayMongo webhook as the primary source of payment status changes.
- Move `ClientDashboardController::syncPendingPayMongoCheckouts()` out of the normal dashboard endpoint.
- Create a targeted endpoint:
  - `/api/payments/{payment}/sync-status`
  - Only called after returning from checkout or when a user clicks refresh payment status.
- Put PayMongo fallback reconciliation into a scheduled queued job.
- Queue notifications and emails:
  - booking status notifications
  - payment reminder emails
  - menu update notifications
  - abandoned booking reminders
- For refunds:
  - Create a refund job per payment.
  - Return quickly with `refund_status=processing`.
  - Update dashboard via polling a small refund status endpoint or broadcasting.
- Lower PayMongo timeout for UI-blocking calls, for example 6-8 seconds, and keep 20 seconds only for queued jobs.

Acceptance target:

- Dashboard loads never wait on PayMongo.
- Refund/payment actions return quickly with clear processing state.
- Webhook reconciliation is idempotent.

### Phase 6: Frontend Rendering Optimization

Goal: reduce React work during navigation, tab switching, and data refresh.

Actions:

- Split large dashboard pages into tab-level components:
  - `AdminAnalyticsTab`
  - `AdminBookingsTab`
  - `AdminUsersTab`
  - `AdminConfigurationTab`
  - `MarketingCalendarTab`
  - `MarketingInquiriesTab`
  - `AccountingVerificationTab`
  - `AccountingLedgerTab`
  - `ClientPaymentsTab`
  - `ClientMenuTab`
- Lazy-load heavy tab components using `React.lazy`.
- Avoid loading Recharts on pages/tabs that do not show charts.
- Move table/list filtering to the server once APIs are paginated.
- Add list virtualization for large lists:
  - admin bookings
  - menu gallery
  - audit logs
  - accounting ledger
- Memoize repeated derived values:
  - `paymentsByBookingId`
  - `menuItemsByCategory`
  - `bookingsByDate`
  - `bookingTotals`
- Debounce:
  - search inputs
  - localStorage draft persistence
  - availability lookups
- Use `AbortController` in fetch effects to cancel stale requests during fast tab/page changes.
- Reduce SmartRefresh scope:
  - refresh only active tab data.
  - use ETag/`If-None-Match` or `updated_since` deltas.
  - increase intervals for stable data to 60-120 seconds.

Acceptance target:

- Tab switches feel instant because heavy work is either cached, paginated, or lazily loaded.
- No dashboard tab blocks the main thread with large `.filter().sort().map()` chains over full datasets.

### Phase 7: Caching Strategy

Goal: cache stable catalog/marketing data without making fresh operational data stale.

Actions:

- Cache public catalog endpoints:
  - `/api/menu`
  - `/api/menu/categories`
  - `/api/menu/bestsellers`
  - `/api/packages`
  - `/api/event-types`
  - `/api/pricing`
- Add cache invalidation whenever admin/settings update menu items, event types, packages, or pricing.
- Cache aggregate analytics longer than 45 seconds if acceptable, for example 2-5 minutes.
- Use per-role cache keys for admin/marketing/accounting dashboard summaries.
- Use browser cache headers/CDN cache for immutable build assets.

Acceptance target:

- Public catalog endpoints usually served from cache.
- Admin setting changes invalidate the right cache keys immediately.

### Phase 8: Page Navigation and Inertia Behavior

Goal: make changing pages feel immediate.

Actions:

- Use Inertia prefetch for common navigation targets:
  - dashboard links
  - booking wizard
  - menu gallery
  - payment page
- Preserve state only where helpful; avoid forcing full reload-like behavior.
- Add skeleton states sized to final layout to prevent visual jumps.
- Use route-level loading indicators that do not block interaction.
- Keep first page render light: fetch secondary data after first paint.

Acceptance target:

- Navigation starts immediately, visible shell renders quickly, and data fills progressively.

## Implementation Order

1. **Day 1: Image and config quick wins**
   - Optimize logo and hero/card images.
   - Add lazy/async image defaults.
   - Prepare production env recommendations.
   - Run `php artisan optimize` on deployment.

2. **Day 2: API payload cuts**
   - Implement paginated admin bookings/customers.
   - Implement paginated accounting bookings/ledger.
   - Replace frontend client-side pagination with server params.

3. **Day 3: Client dashboard and PayMongo flow**
   - Split `/api/dashboard/client`.
   - Remove PayMongo session retrieval from normal dashboard load.
   - Add queued/status endpoint reconciliation.

4. **Day 4: Marketing and calendar**
   - Add month-scoped marketing calendar endpoint.
   - Add paginated inquiries endpoint.
   - Move export generation server-side or make it request a date range endpoint.

5. **Day 5: Frontend splitting and memoization**
   - Split admin, marketing, accounting, and client dashboard tabs.
   - Lazy-load chart-heavy and modal-heavy sections.
   - Add AbortController/debounce where needed.

6. **Day 6: Indexes and query verification**
   - Add missing composite indexes.
   - Run `EXPLAIN ANALYZE`.
   - Adjust query shapes based on real plans.

7. **Day 7: Regression and load testing**
   - Use production-like seed data.
   - Run Lighthouse/WebPageTest.
   - Run endpoint timing checks.
   - Confirm no broken buttons, filters, or role flows.

## Specific File-Level Work Items

### Backend

- `app/Http/Controllers/AdminController.php`
  - Paginate `getBookings`, `getCustomers`, possibly `getEmployees`.
  - Add request filters to SQL.
  - Return slim list serializers.
- `app/Http/Controllers/AccountingController.php`
  - Paginate `getBookingsWithPayments` and `getLedger`.
  - Move ledger grouping/filtering server-side.
  - Add summary endpoint.
- `app/Http/Controllers/MarketingController.php`
  - Split all-bookings endpoint into scoped endpoints.
  - Add calendar month endpoint.
- `app/Http/Controllers/ClientDashboardController.php`
  - Split monolithic `apiData`.
  - Remove PayMongo sync from default dashboard load.
- `app/Http/Controllers/BookingController.php`
  - Replace `whereDate` availability checks with range queries.
  - Queue notification/mail work.
- `app/Services/PayMongoService.php`
  - Add shorter UI timeout option.
  - Keep longer timeout for queued jobs.
- `database/migrations`
  - Add composite indexes listed in Phase 4.

### Frontend

- `resources/js/Pages/DashboardAdmin.jsx`
  - Split tabs into components.
  - Use server-side pagination.
  - Stop fetching every tab's full dataset.
- `resources/js/Pages/DashboardAccounting.jsx`
  - Use server-side payment verification and ledger filters.
  - Fetch current page only.
- `resources/js/Pages/DashboardMarketing.jsx`
  - Use month/inquiry/document endpoints.
  - Avoid filtering all bookings for every calendar cell.
- `resources/js/Pages/client/ClientDashboard.jsx`
  - Fetch active booking detail separately.
  - Build `paymentsByBookingId` once.
  - Avoid loading all history/tastings/payments before first useful paint.
- `resources/js/Pages/client/BookingWizard.jsx`
  - Debounce localStorage writes.
  - Cache package/pricing/menu data across steps.
- `resources/js/Components/client/MenuBuilder.jsx`
  - Memoize category lists and expensive sort results.
  - Consider virtualization if menu grows.
- `resources/js/Components/common/OptimizedImage.jsx`
  - Expand and use everywhere.

## Production Readiness Checklist

- [ ] `APP_DEBUG=false` in production.
- [ ] No real secrets in `.env.example`.
- [ ] Redis or equivalent for cache/session/queue.
- [ ] OPcache enabled.
- [ ] Gzip/Brotli enabled.
- [ ] Build assets served with long cache headers.
- [ ] Logo under 100 KB.
- [ ] Hero images responsive and preloaded only when above the fold.
- [ ] Dashboard list endpoints paginated.
- [ ] Heavy fields excluded from list payloads.
- [ ] PayMongo sync removed from normal dashboard load.
- [ ] Notifications and refunds queued.
- [ ] Slow query logging enabled in staging.
- [ ] Lighthouse checked for home, booking wizard, client dashboard, and staff dashboards.

## Performance Targets

- Home page LCP: under 2.5 seconds on normal 4G.
- Initial staff dashboard TTFB: under 500 ms.
- Staff dashboard API response size: under 100 KB for list pages.
- Client dashboard first useful paint: under 2 seconds after auth.
- Booking wizard step change: under 100 ms main-thread blocking.
- Menu/gallery image transfer: only visible/near-visible images load initially.
- PayMongo-return success page: under 1 second if webhook already confirmed; otherwise show pending state without blocking dashboard refresh.

## Risks and Notes

- The current repository includes a very large local logo asset. Replacing it will create a visible performance win but requires visual QA.
- Server-side pagination changes require frontend updates at the same time, otherwise filters/counts will look incomplete.
- Moving PayMongo checks to background jobs improves speed but needs clear UI states for "processing" and "pending confirmation".
- Redis and queue workers are operational requirements; production must run and monitor workers.
- Some remote image URLs may be useful for demos, but production should not depend on third-party image availability for core UI rendering.
