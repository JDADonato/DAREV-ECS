# Database Context & Migration Guide: SQLite to PostgreSQL (Supabase)

This document provides the full context of the existing Eloquente Catering System (ECS) database schema and a step-by-step guide for migrating to a centralized PostgreSQL database using Supabase.

---

## 🏗 Current Database Schema (SQLite)

The system uses **Laravel 12** with standard Eloquent models. Below are the primary tables and their relationships:

### 1. `users`
- **Purpose:** Authentication and Role-Based Access Control (RBAC).
- **Columns:** `id`, `username` (unique), `password`, `email`, `phone`, `role` (Admin, Marketing, Accounting, Client), `remember_token`, `timestamps`.
- **Note:** Includes OTP and verification fields added in later migrations.

### 2. `bookings`
- **Purpose:** Core business entity for catering events.
- **Columns:** `id`, `user_id` (FK), `event_date`, `event_time`, `pax`, `budget`, `package_id`, `event_type`, `client_full_name`, `venue_address`, `status` (Pending, Confirmed, etc.), `total_cost`, `selected_menu` (JSON), `timestamps`.
- **Relationships:** Belongs to a `User`. Has many `Payments`.

### 3. `menu_items`
- **Purpose:** Catalog of dishes available for catering.
- **Columns:** `id`, `dish_id` (unique), `name`, `category`, `cost_per_head`, `price_adj`, `image`, `description`, `is_best_seller`, `timestamps`.

### 4. `packages`
- **Purpose:** Pre-defined catering bundles.
- **Columns:** `id`, `name`, `type` (wedding, corporate, social, other), `base_price_per_head`, `minimum_pax`, `description`, `inclusions` (JSON), `menu_structure` (JSON), `is_active`, `timestamps`.

### 5. `payments`
- **Purpose:** Tracking financial transactions for bookings.
- **Columns:** `id`, `booking_id` (FK), `amount`, `payment_method`, `proof_image`, `status`, `payment_type` (Reservation, DownPayment, Final), `verified_by`, `verified_at`, `timestamps`.

### 6. Supporting Tables
- `event_types`: Metadata for event categories.
- `business_rules`: System-wide settings (lead days, capacity).
- `notifications`: User alerts.
- `messages`: Chat system.
- `inventory_items` & `dish_ingredients`: Stock management.

---

## 🚀 Migration Prompt for Your AI Agent

Copy and paste the prompt below to your AI coding assistant to handle the migration to Supabase.

> [!IMPORTANT]
> **AI Agent Instructions: Migrate Laravel Database from SQLite to Supabase (PostgreSQL)**
> 
> **Goal:** Transition the Eloquente Catering System from a local SQLite database to a remote PostgreSQL database hosted on Supabase.
> 
> **Context:** > - The project is a Laravel 12 application.
> - Current DB: `database/database.sqlite`
> - Target DB: PostgreSQL (Supabase)
> 
> **Tasks:**
> 1. **Environment Configuration:** Update the `.env` file to use `pgsql` instead of `sqlite`. Configure the host, port, database name, username, and password using the credentials from the Supabase Project Settings.
> 2. **Driver Compatibility:** Ensure the `pdo_pgsql` PHP extension is mentioned in the requirements or enabled if possible.
> 3. **Database Schema:** >    - Run `php artisan migrate` against the new Supabase connection to create the schema. 
>    - *Warning:* PostgreSQL is stricter with types than SQLite. Ensure that JSON columns in migrations are handled correctly (SQLite uses `text`, PostgreSQL uses `json` or `jsonb`).
> 4. **Data Porting (Optional):** If there is critical data in the current SQLite file, suggest a method to export it (e.g., using a tool like `db-converter` or writing a custom Laravel script to read from SQLite and write to PgSQL).
> 5. **Seeding:** Run `php artisan db:seed` to populate the new Supabase instance with the default users and catalog data.
> 6. **Testing:** Verify that the "Login" and "Booking" functionalities work with the new remote connection.
> 
> **Deliverable:** A fully operational Laravel app connected to Supabase with all tables migrated and default data seeded.

---

## 🛠 Manual Steps for the User

1.  **Create a Supabase Project:** Go to [supabase.com](https://supabase.com) and create a new project.
2.  **Get Connection String:** Go to **Project Settings > Database** and find the "Connection String" or "Database Settings".
3.  **Update .env:** Replace the database section in your `.env` with:
    ```env
    DB_CONNECTION=pgsql
    DB_HOST=[your-supabase-host]
    DB_PORT=5432
    DB_DATABASE=postgres
    DB_USERNAME=postgres
    DB_PASSWORD=[your-password]
    ```
4.  **Run Migrations:** Execute `php artisan migrate --seed` once the `.env` is updated.