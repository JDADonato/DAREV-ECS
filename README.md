# Eloquente Catering System (ECS)

A full-stack catering booking and management system built with Laravel 12, Inertia.js, React, Tailwind CSS, and a shared PostgreSQL database hosted on Supabase.

## Tech Stack

| Area | Tool |
| --- | --- |
| Backend | Laravel 12, PHP 8.2+ |
| Frontend | React 19, Inertia.js, Tailwind CSS |
| Database | PostgreSQL on Supabase |
| Build Tool | Vite 7 |

## 🚀 Quick Start (Windows PowerShell)

If you are using the bundled PHP version included in this folder, run these commands from the project folder:

```powershell
# 1. Add the local PHP folder to your terminal session (REQUIRED)
$env:PATH = ".\php;" + $env:PATH

# 2. Install dependencies (if not already done)
php composer.phar install
npm install

# 3. Setup environment and database
php artisan key:generate
php artisan migrate --seed

# 4. Start everything (Backend, Frontend, and Queues)
composer run dev
```

> [!IMPORTANT]
> You must run the `$env:PATH` command **every time** you open a new terminal window. Otherwise, Windows won't know where to find `php` or `composer`.

Then open:

```text
http://127.0.0.1:8080
```

`composer run dev` starts the Laravel server (port 8080), queue listener, and Vite dev server together.

## 📁 Local Environment Details

This setup is designed to be portable and does not require you to install PHP or Composer globally on your Windows machine.

| Tool | Path | Note |
| --- | --- | --- |
| **PHP** | `.\php\php.exe` | Version 8.2+ with pgsql/openssl/mbstring enabled |
| **Composer** | `.\composer.phar` | Run via `php composer.phar` |
| **Database** | `database/database.sqlite` | Default if Supabase is not configured |

## Prerequisites

Install these before running the project:

| Tool | Required Version | Purpose |
| --- | --- | --- |
| Node.js | 18 or newer | Runs Vite and frontend tooling |
| npm | Comes with Node.js | Installs JavaScript packages |
| Supabase project | Active PostgreSQL database | Shared live database (Optional for local SQLite) |

---

## Required PHP Extensions

Laravel needs the PostgreSQL PDO driver to connect to Supabase.

Check your enabled PHP extensions:

```powershell
php -m
```

You should see both:

```text
pdo_pgsql
pgsql
```

If you get `could not find driver` when running migrations, open:

```text
.\php\php.ini
```

Find these lines:

```ini
;extension=pdo_pgsql
;extension=pgsql
```

Remove the semicolons so they become:

```ini
extension=pdo_pgsql
extension=pgsql
```

Save the file, then restart any open terminals. If running through XAMPP Apache, restart Apache too.

Verify again:

```powershell
php -m
```

## Environment Setup

If `.env` does not exist yet, create it:

```powershell
copy .env.example .env
php artisan key:generate
```

Update the database section of `.env` with your Supabase PostgreSQL credentials:

```env
DB_CONNECTION=pgsql
DB_HOST=your-supabase-host
DB_PORT=6543
DB_DATABASE=postgres
DB_USERNAME=postgres.your-project-ref
DB_PASSWORD=your-supabase-database-password
DB_SSLMODE=require
```

Notes:

- Use port `6543` when using the Supabase pooler connection string.
- Use port `5432` only if you are using Supabase's direct database connection.
- Do not commit `.env`; it contains private credentials.
- After changing `.env`, always run:

```powershell
php artisan config:clear
```


## Daily Startup

After the project has already been installed and migrated, use:

```powershell
$env:PATH = ".\php;" + $env:PATH
composer run dev
```

This starts:

| Process | Purpose |
| --- | --- |
| `php artisan serve --port=8080` | Laravel backend |
| `php artisan queue:listen --tries=1 --timeout=0` | Laravel queue worker |
| `npm run dev` | Vite frontend dev server |

Open:

```text
http://127.0.0.1:8080
```

## Manual Startup Alternative

If `composer run dev` does not work, run these in separate terminals:

Terminal 1:

```powershell
$env:PATH = ".\php;" + $env:PATH
php artisan serve --port=8080
```

Terminal 2:

```powershell
npm run dev
```

Terminal 3:

```powershell
$env:PATH = ".\php;" + $env:PATH
php artisan queue:listen --tries=1 --timeout=0
```

## Database Commands

Use these for normal development:

```powershell
$env:PATH = ".\php;" + $env:PATH
php artisan migrate:status
php artisan migrate
php artisan db:seed
```

Use this only for the first setup of an empty Supabase database:

```powershell
php artisan migrate --seed
```

Be careful with this command:

```powershell
php artisan migrate:fresh --seed
```

`migrate:fresh --seed` deletes all database tables and recreates them. Do not run it on the shared Supabase database unless you intentionally want to wipe all existing data.

## Default Accounts

After seeding, these test accounts are available. All use the password:

```text
password123
```

| Role | Username |
| --- | --- |
| Admin | `admin` |
| Marketing | `marketing` |
| Accounting | `accounting` |
| Client | `client` |

You can also register a new client account through the website.

## Troubleshooting

### `could not find driver`

PHP is missing the PostgreSQL driver. Enable these in `.\php\php.ini`:

```ini
extension=pdo_pgsql
extension=pgsql
```

Then restart the terminal and check:

```powershell
php -m
```

### `.env` changes are not being used

Clear Laravel's cached config:

```powershell
php artisan config:clear
```

### Cannot connect to Supabase

Check these `.env` values:

```env
DB_CONNECTION=pgsql
DB_HOST=your-supabase-host
DB_PORT=6543
DB_DATABASE=postgres
DB_USERNAME=postgres.your-project-ref
DB_PASSWORD=your-password
DB_SSLMODE=require
```

Also confirm your internet connection and that the Supabase project is not paused.

### `prepared statement ... does not exist`

This can happen when using the Supabase pooler on port `6543`. The project fixes this in `config/database.php` by disabling PostgreSQL server-side prepared statements for the `pgsql` connection:

```php
'options' => extension_loaded('pdo_pgsql') ? [
    PDO::ATTR_EMULATE_PREPARES => true,
    PDO::PGSQL_ATTR_DISABLE_PREPARES => true,
] : [],
```

After changing database config, run:

```powershell
php artisan config:clear
```

If the app is already running, stop it and start it again:

```powershell
composer run dev
```

### Port already in use

Start Laravel on another port:

```powershell
php artisan serve --port=8081
```

Then open:

```text
http://127.0.0.1:8081
```

### Frontend changes are not showing

Make sure Vite is running:

```powershell
npm run dev
```

If needed, restart `composer run dev`.

## Useful Commands

```powershell
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear
php artisan migrate:status
php artisan test
npm run build
```

## Features

- Landing page with hero carousel, about section, and gallery
- Menu gallery with category and price filtering
- Custom package builder
- Multi-step booking workflow
- Booking cost summary
- Client dashboard for bookings, payments, and event details
- Marketing/Admin booking management
- Accounting payment verification
- Admin employee management, pricing overrides, and analytics
- Notifications and messaging

## Project Structure

```text
ECS-LATEST-main/
|-- app/                 Laravel backend code
|-- bootstrap/           Laravel bootstrap files
|-- config/              Laravel configuration
|-- database/            Migrations, factories, and seeders
|-- public/              Public web assets
|-- resources/
|   |-- css/             Stylesheets
|   |-- images/          Static images
|   `-- js/              React/Inertia frontend
|-- routes/              Laravel routes
|-- storage/             Runtime storage and logs
|-- tests/               Automated tests
|-- .env                 Local private environment config
|-- composer.json        PHP dependencies and scripts
|-- package.json         Frontend dependencies and scripts
`-- vite.config.js       Vite configuration
```

## License

This project is proprietary software for Eloquente Catering.
