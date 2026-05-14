# Eloquente Catering System (ECS)

A premium, full-stack catering management platform. This system handles everything from landing pages and custom menu building to real-time client-staff communication and booking management.

## 🛠️ Tech Stack

*   **Backend**: Laravel 11 (PHP 8.2+)
*   **Frontend**: React 19 (Inertia.js), Tailwind CSS
*   **Database**: PostgreSQL (Supabase)
*   **Real-Time**: Laravel Reverb (WebSockets)
*   **Build Tool**: Vite 6+

---

## 🚀 One-Click Quick Start (Windows)

This project is designed to be **portable**. It includes a local PHP folder, so you don't need to install PHP on your computer.

1.  **Open PowerShell** in the project folder.
2.  **Activate Local PHP**:
    ```powershell
    $env:PATH = ".\php;" + $env:PATH
    ```
3.  **Install Everything**:
    ```powershell
    php composer.phar install
    npm install
    ```
4.  **Setup Environment**:
    *   Create a `.env` file (copy from `.env.example`).
    *   Add your **Supabase PostgreSQL** credentials (see [Database Setup](#-database-setup)).
    *   Add **Reverb Credentials** (see [Real-Time Chat Setup](#-real-time-chat-setup)).
5.  **Initialize Database**:
    ```powershell
    php artisan key:generate
    php artisan migrate --seed
    ```
6.  **Run the System**:
    ```powershell
    composer run dev
    ```

> [!IMPORTANT]
> `composer run dev` starts **4 essential processes**:
> 1. Laravel Web Server (8080)
> 2. Vite Dev Server (Frontend)
> 3. Laravel Reverb (WebSocket Server)
> 4. Queue Worker (for Emails & Notifications)

---

## 💬 Real-Time Chat Setup

The chat system uses **Laravel Reverb**. For it to work correctly, your `.env` MUST have these values:

```env
BROADCAST_CONNECTION=reverb

REVERB_APP_ID=your-id
REVERB_APP_KEY=your-key
REVERB_APP_SECRET=your-secret
REVERB_HOST="127.0.0.1"
REVERB_PORT=8085
REVERB_SCHEME=http

VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST="${REVERB_HOST}"
VITE_REVERB_PORT="${REVERB_PORT}"
VITE_REVERB_SCHEME="${REVERB_SCHEME}"
```

### If Chat isn't connecting:
1.  Ensure you ran `composer run dev` (it starts the Reverb server automatically).
2.  Check that port `8085` is not blocked by a firewall.
3.  Make sure your PHP has the `openssl` and `curl` extensions enabled in `php/php.ini`.

---

## 📧 Email Notifications

Notifications (like "New Message" alerts) are sent to the **Laravel Queue**.
*   **During Development**: Emails are logged to `storage/logs/laravel.log`.
*   **To Send Real Emails**: Update the `MAIL_` variables in your `.env` with SMTP credentials (e.g., Gmail App Password).

---

## 🗄️ Database Setup

We use **Supabase** for the live database. In your `.env`, set:

```env
DB_CONNECTION=pgsql
DB_HOST=aws-0-ap-southeast-1.pooler.supabase.com # Use your Supabase host
DB_PORT=6543
DB_DATABASE=postgres
DB_USERNAME=postgres.your-project-ref
DB_PASSWORD=your-password
DB_SSLMODE=require
```

> [!TIP]
> If you get a "Prepared statement does not exist" error, ensure `DB_PORT=6543` is used (Supabase Transaction Mode).

---

## 🔑 Default Accounts

After running `php artisan db:seed`, use these credentials (Password: `password123`):

| Role | Username |
| :--- | :--- |
| **Admin** | `admin` |
| **Marketing** | `marketing` |
| **Accounting** | `accounting` |
| **Client** | `client` |

---

## 📂 Project Structure

*   `app/Http/Controllers/ChatController.php`: Core logic for the ticketing/claiming system.
*   `resources/js/Components/common/StaffMessaging.jsx`: Staff side chat interface.
*   `resources/js/Components/common/ChatBubble.jsx`: Client side floating chat bubble.
*   `app/Notifications/`: Email and database notification templates.
*   `routes/channels.php`: Authorization rules for private WebSocket channels.

---

## 🛠️ Troubleshooting

*   **"Could not find driver"**: Open `php/php.ini` and remove the `;` before `extension=pdo_pgsql` and `extension=pgsql`.
*   **Vite not loading**: Ensure `npm run dev` is running (included in `composer run dev`).
*   **PHP Commands not found**: Remember to run `$env:PATH = ".\php;" + $env:PATH` in **every new terminal window**.

---
*Developed for Eloquente Catering. Phase 2: WebSocket Integration Complete.*
