# Eloquente Catering System (ECS)

A premium, full-stack catering management platform. This system handles everything from landing pages and custom menu building to real-time client-staff communication and booking management.

## 🛠️ Tech Stack

*   **Backend**: Laravel 11 (PHP 8.2+)
*   **Frontend**: React 19 (Inertia.js), Tailwind CSS
*   **Database**: PostgreSQL (Supabase)
*   **Real-Time**: Laravel Reverb (WebSockets)
*   **Build Tool**: Vite 6+

---

## 🚀 One-Time Setup (Windows)

This project is designed to be **portable**. It includes a local PHP folder, so you don't need to install PHP globally on your computer.

1.  **Open PowerShell** in the project folder.
2.  **Enable Local PHP & Composer**:
    ```powershell
    $env:PATH = ".\php;" + $env:PATH
    ```
3.  **Ensure PostgreSQL Extensions are Enabled**:
    Open `php/php.ini` and ensure these lines are **NOT** commented out (remove the `;`):
    ```ini
    extension=pdo_pgsql
    extension=pgsql
    extension=openssl
    extension=curl
    ```
4.  **Install Dependencies**:
    ```powershell
    php composer.phar install
    npm install
    ```
5.  **Setup Environment**:
    *   Create a `.env` file from `.env.example`.
    *   Add your **Supabase PostgreSQL** credentials (see [Database Setup](#-database-setup)).
    *   Add **Reverb Credentials** for Chat.
6.  **Initialize Database**:
    ```powershell
    php artisan key:generate
    php artisan migrate --seed
    ```

---

## ⚡ Daily Startup Routine

Every time you start working, follow these steps in a new PowerShell window:

1.  **Activate PHP Path**:
    ```powershell
    $env:PATH = ".\php;" + $env:PATH
    ```
2.  **Clear Caches (If needed)**:
    ```powershell
    php artisan optimize:clear
    ```
3.  **Run the System**:
    ```powershell
    composer run dev
    ```

> [!IMPORTANT]
> `composer run dev` starts **4 essential processes**:
> 1. **Laravel Web Server** (http://127.0.0.1:8080)
> 2. **Vite Dev Server** (Hot Module Replacement)
> 3. **Laravel Reverb** (WebSocket Server for Chat)
> 4. **Queue Worker** (Processes Emails & Notifications)

---

## 🗄️ Database Setup (Supabase)

We use **Supabase** for the shared live database. Because Supabase uses a pooler, you must use **Port 6543** for Transaction Mode.

**In your `.env`:**
```env
DB_CONNECTION=pgsql
DB_HOST=aws-0-ap-southeast-1.pooler.supabase.com # Your Supabase Host
DB_PORT=6543
DB_DATABASE=postgres
DB_USERNAME=postgres.your-project-ref
DB_PASSWORD=your-password
DB_SSLMODE=require
```

**Supabase Configuration Note:**
In `config/database.php`, the app is configured to disable server-side prepared statements to maintain compatibility with the Supabase pooler:
```php
'options' => [
    PDO::ATTR_EMULATE_PREPARES => true,
    PDO::PGSQL_ATTR_DISABLE_PREPARES => true,
]
```

---

## 💬 Real-Time Chat & Notifications

The chat system uses **Laravel Reverb**. 

1.  Ensure `BROADCAST_CONNECTION=reverb` in `.env`.
2.  If the chat bubble says "Disconnected," verify that port `8085` is open.
3.  Client side uses `ChatBubble.jsx`.
4.  Staff side uses `StaffMessaging.jsx` inside the Operations Dashboard.

---

## 🔑 Default Accounts (Post-Seed)

**Password for all:** `password123`

| Role | Username |
| :--- | :--- |
| **Admin** | `admin` |
| **Marketing** | `marketing` |
| **Accounting** | `accounting` |
| **Client** | `client` |

---

## 📂 Key Files & Directories

*   `app/Http/Controllers/PaymentController.php`: Handles payment flow (Currently simulated - see [darevhandoff.md](file:///darevhandoff.md)).
*   `resources/js/Pages/client/MenuGallery.jsx`: Main menu exploration for clients.
*   `resources/js/Components/client/MenuBuilder.jsx`: Custom package builder.
*   `app/Services/BusinessRulesService.php`: Core logic for booking availability and pax limits.
*   `darevhandoff.md`: **Crucial Read** for technical gaps, security risks, and the remaining implementation roadmap.

---

## 🛠️ Troubleshooting

*   **"Could not find driver"**: Ensure `pdo_pgsql` is enabled in `php/php.ini`.
*   **"Prepared statement already exists"**: Ensure you are using **Port 6543** and not 5432.
*   **White Screen on Login**: Run `php artisan config:clear` and `php artisan route:clear`.
*   **Vite Manifest Missing**: Run `npm run build` once to generate assets if `composer run dev` is not being used.

---
*Developed for Eloquente Catering System.*

