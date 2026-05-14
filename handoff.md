# ECS Supabase Migration Handoff

## Goal

Move the Eloquente Catering System from local SQLite to a shared live PostgreSQL database hosted on Supabase, while keeping the Laravel/Inertia/React app easy to run locally for the team.

The app should:

- Use Supabase PostgreSQL as the shared database.
- Let users register and log in.
- Let clients create bookings and check event-date availability.
- Let staff dashboards work for Marketing, Accounting, and Admin.
- Use Row Level Security where possible so client users only access their own rows while staff roles can still perform operational work.

## Current State

The app is connected to Supabase PostgreSQL and migrations have run successfully.

Important runtime notes:

- Local PHP is XAMPP PHP: `C:\xampp\php\php.exe`
- PHP config is: `C:\xampp\php\php.ini`
- PostgreSQL PHP extensions were enabled:
  - `pdo_pgsql`
  - `pgsql`
- Supabase pooler is being used on port `6543`.
- Laravel PostgreSQL config disables server-side prepared statements for Supabase pooler compatibility.
- Booking availability now shows `7` remaining event slots by default instead of `3`.
- RLS has been enabled on public tables with policies for own-row client access and staff operational access.

## Files Actively Edited

- `README.md`
- `config/database.php`
- `app/Http/Controllers/AuthController.php`
- `app/Http/Controllers/MenuController.php`
- `app/Http/Controllers/PackageController.php`
- `app/Models/BusinessRule.php`
- `app/Services/BusinessRulesService.php`
- `app/Http/Middleware/SetPostgresSessionContext.php`
- `bootstrap/app.php`
- `routes/web.php`
- `resources/js/context/AuthContext.jsx`
- `resources/js/Pages/DashboardOps.jsx`
- `database/seeders/DatabaseSeeder.php`
- `database/migrations/0001_01_02_000005_create_menu_and_business_tables.php`
- `database/migrations/2026_05_13_220000_enable_rls_and_update_booking_capacity.php`
- `database/migrations/2026_05_13_221000_harden_user_registration_rls_policy.php`

## What We Did

### PostgreSQL Driver Fix

The first migration attempt failed with:

```text
could not find driver
```

Cause: PHP CLI did not have PostgreSQL PDO enabled.

Fix: enabled these in `C:\xampp\php\php.ini`:

```ini
extension=pdo_pgsql
extension=pgsql
```

Verified with:

```powershell
php -m
```

### Supabase Migration and Seeding

Ran:

```powershell
php artisan config:clear
php artisan migrate --seed
php artisan migrate:status
```

Migrations and seeders completed successfully on Supabase.

### Supabase Pooler Prepared Statement Fix

After registration, the app failed with:

```text
prepared statement "pdo_stmt_..." does not exist
```

Cause: Supabase pooler/PgBouncer does not preserve server-side prepared statements in the way PDO expected.

Fix added in `config/database.php`:

```php
'options' => extension_loaded('pdo_pgsql') ? [
    PDO::ATTR_EMULATE_PREPARES => true,
    PDO::PGSQL_ATTR_DISABLE_PREPARES => true,
] : [],
```

### Boolean Query Fixes for PostgreSQL

Availability checks failed because PostgreSQL rejected SQLite-style boolean comparisons such as:

```sql
where "is_active" = 1
```

Fixed boolean queries in:

- `app/Models/BusinessRule.php`
- `app/Http/Controllers/MenuController.php`
- `app/Http/Controllers/PackageController.php`

Availability endpoint then returned valid JSON:

```json
{
  "remainingEvents": 7,
  "remainingPax": 3500
}
```

### Booking Slot Limit Updated

Changed default max event slots per day from `3` to `7`.

Updated:

- Current Supabase `business_rules.maximum_capacity_per_day`
- Fresh migration default
- Seeder value
- Fallback constant in `BusinessRulesService`

### RLS Work

Added `app/Http/Middleware/SetPostgresSessionContext.php`.

Purpose: because the app uses Laravel session auth, not Supabase Auth, PostgreSQL needs Laravel to set session variables:

- `app.current_user_id`
- `app.current_user_role`

Added RLS helper functions and policies in:

```text
database/migrations/2026_05_13_220000_enable_rls_and_update_booking_capacity.php
```

Then hardened public registration in:

```text
database/migrations/2026_05_13_221000_harden_user_registration_rls_policy.php
```

Verified:

- RLS enabled on `22` public tables.
- `66` policies created.
- Marketing role can read bookings under RLS.

### Marketing Login / Inertia JSON Issue

Marketing login showed:

```text
All Inertia requests must receive a valid Inertia response, however a plain JSON response was received.
[]
```

Likely cause: Laravel `redirect()->intended(...)` remembered an API endpoint like `/api/ops/bookings` as the intended destination. After login, Inertia followed that URL and received JSON instead of a page.

Fix in `AuthController.php`:

```php
return redirect($this->getDashboardRoute($user->role))
```

Also updated `DashboardOps.jsx` API requests to explicitly send:

```js
Accept: 'application/json'
```

### README Update

Rewrote `README.md` as a practical setup/runbook covering:

- Supabase `.env` setup
- PHP PostgreSQL extensions
- First-time setup
- Daily startup
- Migration commands
- Troubleshooting for driver, pooler, and config cache errors

## Failed Attempts / Things That Did Not Work

- `php artisan migrate --seed` initially failed because PHP lacked `pdo_pgsql`.
- Migration retry inside the sandbox failed with Windows socket permission error `10013`; rerunning with network permission worked.
- Supabase dashboard briefly showed a white screen in Chrome. This appeared to be a browser/Supabase dashboard loading issue, not caused by app migrations.
- Several inline `php artisan tinker --execute=...` checks failed because PowerShell quoting mangled PHP namespaces, `count(*)`, or `?` placeholders.
- Temporary PHP verification scripts under `tools/` were created to avoid quoting problems, then deleted.
- `php artisan optimize:clear` first failed in sandbox because it needed to delete database-backed cache rows in Supabase; rerunning with network permission worked.
- `npm run build` failed because PowerShell blocks `npm.ps1`; using `npm.cmd run build` fixed that.
- `npm.cmd run build` first failed in sandbox due to file-access restrictions around Vite/esbuild; rerunning with permission succeeded.
- Scripted login testing with `Invoke-WebRequest` did not preserve the Laravel/Inertia session cleanly, so it was not reliable for confirming the browser issue.

## Verification Already Done

Successful checks included:

```powershell
php -m
php artisan migrate --seed
php artisan migrate:status
php artisan config:clear
php artisan route:clear
php -l app\Http\Controllers\AuthController.php
php -l routes\web.php
php -l app\Http\Middleware\SetPostgresSessionContext.php
npm.cmd run build
```

Availability endpoint returned:

```json
{
  "date": "2026-05-21",
  "isFull": false,
  "remainingPax": 3500,
  "remainingEvents": 7,
  "currentPax": 0,
  "currentEvents": 0
}
```

## Next Step I Would Take

Restart the dev server and do a browser smoke test with each role:

```powershell
Ctrl + C
composer run dev
```

Then test:

- Login as `marketing` and confirm `/dashboard/ops` loads.
- Login as `accounting` and confirm `/dashboard/finance` loads.
- Login as `admin` and confirm `/dashboard/admin` loads.
- Login/register as a client and create a booking.
- Confirm booking availability still shows `7` slots.
- Confirm Marketing can see submitted bookings.

If Marketing still sees the Inertia JSON error, clear browser site data for `127.0.0.1` or test in Incognito, because an old intended URL may still be stored in the Laravel session cookie.
