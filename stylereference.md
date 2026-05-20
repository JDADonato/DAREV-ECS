# Eloquente Customer Style Reference

Use this guide when updating customer-facing pages so the experience stays consistent across Home, About, Contact, Menu, Booking, Auth, and Client Dashboard.

## Brand Feel

The customer UI should feel premium, warm, operationally clear, and event-focused. It should balance elegant catering imagery with practical planning surfaces: dates, menus, guest counts, payments, and status tracking.

Avoid generic SaaS styling. Eloquente pages should look like a catering service with a polished booking system, not a marketing template.

## Core Palette

- Primary burgundy: `#720101`
- Burgundy hover/deep: `#5a0101`, `#4a0000`
- Near-black: `#1a1a1a`, `#15110f`, `#17120f`
- Gold accent: `#f0aa0b`
- Warm page background: `#f7f4ee`, `#faf7f2`, `#fffaf3`
- Text gray: Tailwind `gray-500`, `gray-600`, `slate-500`
- Success: Tailwind green/emerald tones
- Warning/payment urgency: gold/amber and restrained red

Use burgundy for primary actions and active navigation. Use gold for accents, small labels, progress highlights, and special CTAs. Keep large backgrounds warm neutral or image-led.

## Typography

- Use `font-sans` for body and forms.
- Use `font-display` for page headings, section titles, and premium brand moments.
- Labels usually use uppercase, high weight, and modest tracking.
- Do not overuse uppercase in paragraphs or long helper text.
- Keep dashboard and form copy direct and concise.

Suggested scale:
- Hero H1: `text-4xl` to `text-6xl`, image-backed or dark section.
- Section H2: `text-3xl` to `text-4xl`.
- Panel title: `text-xl` to `text-2xl`.
- Form labels: `text-xs` or `text-[11px]`, bold/black.
- Body/helper text: `text-sm`, `leading-6` or `leading-7`.

## Layout

- Shared customer navbar height is `68px`; pages using it should offset with `pt-[68px]` or top padding near `100px` for dashboards.
- Use `max-w-7xl mx-auto px-5 sm:px-8` for most page shells.
- Public pages use full-width sections, not nested decorative cards.
- Operational pages may use cards for workflows, repeated records, modals, and dashboard panels.
- Prefer grid layouts that collapse cleanly: `lg:grid-cols-2`, `sm:grid-cols-2`, and clear single-column mobile views.

## Navbar

Use `ClientNavbar` for public/customer routes.

Patterns:
- Fixed top, burgundy background, subtle border, blur, and shadow.
- Logo left, links right.
- Active link: gold pill with dark text.
- Inactive links: white with hover white/10.
- Logged-in users see Dashboard, notifications, and user menu.

Do not rebuild page-specific navbars unless there is a strong reason. Several older hidden nav blocks exist in customer pages; new work should rely on `ClientNavbar`.

## Buttons

Primary customer CTA:
- Burgundy background, white text, bold, rounded full or rounded-xl depending on context.
- Hover deep burgundy.
- Use gold only for special high-emphasis CTAs, especially hero or checkout-related actions.

Secondary CTA:
- White or transparent surface.
- Burgundy text.
- Thin burgundy or neutral border.

Operational buttons:
- Use rounded-xl.
- Keep text short.
- Include icons for action clarity when the button starts a tool-like action.

## Cards and Panels

Public marketing cards:
- White or warm neutral surface.
- Subtle border `border-gray-100`.
- Shadow should be soft, not heavy.
- Image cards should reveal actual food, events, service, or venue context.

Operational panels:
- White or near-black sections depending on priority.
- Use clear internal spacing: `p-5`, `p-6`, `p-8`.
- Keep controls and data close together.
- Avoid putting cards inside decorative wrapper cards.

## Forms

Auth forms use shared classes:
- `.auth-field`
- `.auth-field-compact`
- `.auth-input`
- `.auth-label`
- `.auth-submit`
- `.auth-error`

Customer forms outside auth:
- Rounded-xl fields.
- Border transparent or subtle gray.
- Focus color should be burgundy.
- Helper/error text should be short and placed near the field or at the top of the form.

## Motion

Current customer motion vocabulary:
- Reveal on scroll: `.rv`, `.rv-left`, `.rv-right`, `.rv-scale`.
- Menu card enter: `.animate-fadeInUp`.
- Modals/lightboxes: `overlayIn`, `imgZoomIn`, `slideUp`.
- Auth pages: directional card/form enter and exit transitions.

Use motion to clarify state changes. Avoid adding unrelated floating decoration. Respect `prefers-reduced-motion`.

## Imagery

Use real-looking event, food, chef, venue, or service imagery. The landing and about pages rely on full-bleed photography and dark overlays. Menu imagery should show inspectable food, not abstract backgrounds.

Fallback food images should be high quality and category-appropriate.

## Customer Page Patterns

- Home: full-bleed image hero, burgundy/dark overlay, gold accent CTA, section storytelling, final CTA.
- About: image-led dark hero, stats panel, white/warm content sections.
- Contact: compact dark header, practical contact cards, simple form.
- Menu: burgundy header, best sellers, filters/search/sort, paginated dish grid, package drawer.
- Booking Wizard: one primary white workflow card plus a persistent summary panel.
- Client Dashboard: warm background, dark status hero, tabs for operational work, strong payment/action states.
- Auth: shared image split shell, animated card transition, compact modern form.

## File Structure Notes

- Prefer `resources/js/Components` with consistent uppercase imports. Mixed `components`/`Components` imports can pass on Windows and fail on case-sensitive systems.
- Prefer `ClientNavbar` instead of duplicating page-local nav blocks.
- `resources/js/app.js` only imports bootstrap and is not in the Vite input; keep future entry work in `resources/js/app.jsx` unless the build config changes.
- There are two client layout locations: `resources/js/Layouts/ClientLayout.jsx` and `resources/js/Components/layout/ClientLayout.jsx`. Consolidate before building more layout behavior.
- Some older client pages/components appear unused by current routes, including `DashboardClient.jsx`, `client/ClientOverview.jsx`, `client/PackageCustomizer.jsx`, `PackageSelector.jsx`, and `BudgetEstimator.jsx`. Verify before deleting because `import.meta.glob` can still load routed pages by name.

## Implementation Checklist

- Use `ClientNavbar` and correct top offset.
- Use brand colors from this document.
- Keep copy concise and decision-oriented.
- Use food/event imagery where a page is public-facing.
- Use existing auth/form classes before creating new form styles.
- Keep dashboard interactions dense, scannable, and practical.
- Build mobile-first and verify text does not overflow buttons, cards, or tabs.
