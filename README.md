# Eloquente Catering System (ECS)

A premium, full-stack catering management platform. This system handles everything from landing pages and custom menu building to real-time client-staff communication, booking management, and integrated PayMongo payments.

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Backend** | Laravel 12 (PHP 8.2+) |
| **Frontend** | React 19 (Inertia.js), Tailwind CSS |
| **Database** | PostgreSQL (Supabase) |
| **Payments** | PayMongo (Test Mode) |
| **Real-Time** | Laravel Reverb (WebSockets) |
| **Tunneling** | ngrok (for PayMongo webhooks) |
| **Build Tool** | Vite 7+ |

## 📋 Prerequisites

Before you start, make sure you have the following installed on your Windows machine:

| Software | Version | Download Link |
| :--- | :--- | :--- |
| **Node.js** | v18 or higher | https://nodejs.org/ |
| **Git** | Any recent version | https://git-scm.com/ |
| **ngrok** | v3 (free account) | https://ngrok.com/download |

> [!NOTE]
> **You do NOT need to install PHP or Composer globally.** This project includes a portable `php/` folder and `composer.phar` — everything runs from the project directory.

---

## 🚀 One-Time Setup (Step by Step)

Follow these steps **exactly in order** when setting up the project for the first time.

### Step 1: Clone the Repository

```powershell
git clone https://github.com/mavvricks/ECS-LATEST.git
cd ECS-LATEST
```

### Step 2: Enable the Local PHP

The project ships with a `php/` folder. You need to tell PowerShell to use it:

```powershell
$env:PATH = ".\php;" + $env:PATH
```

> [!IMPORTANT]
> You must run this command **every time** you open a new PowerShell window. It only lasts for the current session.

Verify it works:

```powershell
php --version
```

You should see `PHP 8.2.x`.

### Step 3: Enable PostgreSQL Extensions in PHP

This is a **critical step** that many people miss. Open the file `php/php.ini` in any text editor (Notepad, VS Code, etc.) and find these lines. **Remove the `;` at the beginning** of each line if it's there:

```ini
extension=pdo_pgsql
extension=pgsql
extension=openssl
extension=curl
```

> [!CAUTION]
> If `pdo_pgsql` and `pgsql` are still commented out (have a `;` in front), you will get this error when running migrations:
> ```
> could not find driver (Connection: pgsql)
> ```
> **Fix:** Remove the `;` from those lines, save the file, and try again.

### Step 4: Install Dependencies

```powershell
php composer.phar install
npm install
```

### Step 5: Set Up the Environment File

Copy `.env.example` to create your `.env`:

```powershell
Copy-Item .env.example .env
```

Now open `.env` in a text editor and update the following sections:

#### App Settings

```env
APP_NAME=Eloquente
APP_URL=http://127.0.0.1:8080
```

#### Database (Supabase PostgreSQL)

Get these credentials from the project lead or the Supabase dashboard:

```env
DB_CONNECTION=pgsql
DB_HOST=aws-1-ap-northeast-1.pooler.supabase.com
DB_PORT=6543
DB_DATABASE=postgres
DB_USERNAME=postgres.your-project-ref
DB_PASSWORD=your-database-password
```

> [!WARNING]
> You **must** use port `6543` (Transaction Mode), not `5432`. Using port 5432 will cause "prepared statement already exists" errors.

#### Real-Time Chat (Reverb)

These can stay as the defaults from `.env.example`:

```env
BROADCAST_CONNECTION=reverb
REVERB_APP_ID=eloquente-local
REVERB_APP_KEY=eloquente-reverb-key
REVERB_APP_SECRET=eloquente-reverb-secret
REVERB_HOST=localhost
REVERB_PORT=8085
REVERB_SCHEME=http
```

#### PayMongo (Payments)

Get the test keys from the project lead:

```env
PAYMONGO_BASE_URL=https://api.paymongo.com
PAYMONGO_CHECKOUT_ENDPOINT=/v1/checkout_sessions
PAYMONGO_PUBLIC_KEY=pk_test_...
PAYMONGO_SECRET_KEY=sk_test_...
PAYMONGO_WEBHOOK_SECRET=                          # Leave blank — auto-filled by sync command
PAYMONGO_CURRENCY=PHP
PAYMONGO_PAYMENT_METHOD_TYPES=card,gcash,paymaya
PAYMONGO_SEND_EMAIL_RECEIPT=true
PAYMONGO_STATEMENT_DESCRIPTOR=ELOQUENTE
PAYMONGO_TIMEOUT=20
PAYMONGO_CA_BUNDLE=storage/app/cacert.pem
PAYMONGO_WEBHOOK_TOLERANCE=300
```

#### ngrok Path

Find where `ngrok.exe` is installed on your computer and set the path:

```powershell
# Run this in PowerShell to find your ngrok path:
where.exe ngrok
```

Then put the result in `.env` using **single quotes** (to avoid escape sequence errors):

```env
NGROK_PATH='C:\Users\YourName\AppData\Local\Microsoft\WindowsApps\ngrok.exe'
```

> [!TIP]
> If you installed ngrok via the MSI installer or Microsoft Store, the path is usually:
> `C:\Users\YourName\AppData\Local\Microsoft\WindowsApps\ngrok.exe`
>
> If you downloaded the ZIP manually, it's wherever you extracted it, for example:
> `C:\Users\YourName\Downloads\ngrok-v3-stable-windows-amd64\ngrok.exe`
>
> **Always use single quotes** around the path in `.env` to prevent PHP parsing errors with backslashes.

### Step 6: Download the SSL Certificate Bundle

PayMongo requires HTTPS connections. PHP needs a CA certificate bundle to verify these. Run this command to download it:

```powershell
Invoke-WebRequest -Uri "https://curl.se/ca/cacert.pem" -OutFile "storage\app\cacert.pem"
```

> [!CAUTION]
> Without this file, you will see this error when trying to pay:
> ```
> Unable to connect securely to PayMongo. Please verify the configured CA bundle and internet connection.
> ```
> **Fix:** Run the download command above, make sure the file exists at `storage/app/cacert.pem`.

### Step 7: Generate App Key and Run Migrations

```powershell
php artisan key:generate
php artisan migrate --seed
```

This creates all database tables and populates them with default data (users, menu items, packages, etc.).

### Step 8: Set Up the ngrok Auth Token (First Time Only)

If you haven't used ngrok before on this computer, you need to authenticate it:

1. Create a free account at https://ngrok.com/
2. Go to https://dashboard.ngrok.com/get-started/your-authtoken
3. Copy your auth token
4. Run:

```powershell
ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
```

---

## ⚡ Daily Startup Routine

Every time you start working, follow these steps in a new PowerShell window:

### Terminal 1 — Start the Application

```powershell

# Step 1: Enable local PHP (required every new terminal)
$env:PATH = ".\php;" + $env:PATH

# Step 2: Clear any stale caches
php artisan optimize:clear

# Step 3: Start all services
composer run dev
```

> [!IMPORTANT]
> `composer run dev` starts **4 services simultaneously**:
> | Service | URL | Purpose |
> | :--- | :--- | :--- |
> | Laravel Web Server | http://127.0.0.1:8080 | Main application |
> | Vite Dev Server | http://localhost:5173 | Frontend hot-reload |
> | Laravel Reverb | ws://localhost:8085 | WebSocket chat |
> | Queue Worker | (background) | Emails & notifications |
>
> **Keep this terminal open** while you work. Closing it stops everything.

### Terminal 2 — Sync PayMongo Webhook

Open a **second** PowerShell window:

```powershell
cd path\to\ECS-LATEST
$env:PATH = ".\php;" + $env:PATH
php artisan paymongo:webhook-sync
```

This command automatically:
1. ✅ Starts ngrok (or detects a running instance)
2. ✅ Discovers the public HTTPS URL
3. ✅ Disables any old PayMongo webhooks
4. ✅ Creates a new webhook for your current ngrok URL
5. ✅ Updates `PAYMONGO_WEBHOOK_SECRET` in your `.env`
6. ✅ Clears the config cache

You should see output like this:

```
🔄 PayMongo Webhook Sync

🚀 Starting ngrok on port 8080...
⏳ Waiting for ngrok to initialize...
✅ Ngrok public URL: https://xxxx-xxxx-xxxx.ngrok-free.dev
📍 Webhook endpoint: https://xxxx-xxxx-xxxx.ngrok-free.dev/webhook/paymongo

📋 Fetching existing PayMongo webhooks...
   Found X existing webhook(s).
✅ Webhook created/enabled: hook_xxxxx

════════════════════════════════════════════════
  ✅ PayMongo webhook sync complete!
════════════════════════════════════════════════
```

> [!WARNING]
> **If multiple teammates share the same PayMongo test account:** Only the **last person who ran the sync command** will receive webhook updates from PayMongo. If your teammate is currently testing payments, let them finish before running the sync command on your machine.

---

## 💳 Testing Payments (PayMongo)

### How Payments Work

1. Client clicks **"Proceed to Checkout"** on the dashboard
2. ECS creates a PayMongo Checkout Session
3. Client is redirected to PayMongo's secure hosted payment page
4. Client pays using a test card
5. PayMongo sends a **webhook** back to ECS via ngrok
6. ECS verifies the webhook signature and marks the payment as **Paid**
7. The booking milestone advances automatically (10% → 70% → 20%)

### Test Card Numbers

Use these test cards on the PayMongo checkout page:

| Scenario | Card Number | Expiry | CVC | Result |
| :--- | :--- | :--- | :--- | :--- |
| ✅ Successful (3DS) | `4120 0000 0000 0007` | Any future date | Any 3 digits | Payment succeeds (choose "Authorize" on test page) |
| ✅ Successful (non-3DS) | `5555 4444 4444 4457` | Any future date | Any 3 digits | Payment succeeds immediately |
| ❌ Failed payment | `4200 0000 0000 0018` | Any future date | Any 3 digits | Payment fails (expired card) |

> [!NOTE]
> **Where to see test transactions:** On the PayMongo Dashboard, make sure the **"Test Mode"** toggle is turned ON. Test transactions do **not** appear in Live Mode.

### Verifying Webhook Delivery

After a test payment, open the ngrok inspector in your browser:

```
http://127.0.0.1:4040
```

You should see a `POST /webhook/paymongo` request with a `200 OK` response. If no request appears, PayMongo is not reaching your app — re-run `php artisan paymongo:webhook-sync`.

---

## 🔑 Default Accounts (After Seeding)

**Password for all accounts:** `password123`

| Role | Username | Dashboard URL |
| :--- | :--- | :--- |
| **Admin** | `admin` | `/dashboard/admin` |
| **Marketing** | `marketing` | `/dashboard/marketing` |
| **Accounting** | `accounting` | `/dashboard/accounting` |
| **Client** | `client` | `/dashboard/client` |

---

## 💬 Real-Time Chat & Notifications

The chat system uses **Laravel Reverb** (WebSockets).

- Ensure `BROADCAST_CONNECTION=reverb` in `.env`
- Chat runs on port `8085` (started automatically by `composer run dev`)
- If the chat bubble says "Disconnected", check that port `8085` is not blocked
- Client side: `ChatBubble.jsx`
- Staff side: `StaffMessaging.jsx` (Marketing Dashboard)

---

## 📂 Key Files & Directories

| File | Description |
| :--- | :--- |
| `app/Http/Controllers/PaymentController.php` | Creates PayMongo Checkout Sessions (10/70/20 milestones) |
| `app/Http/Controllers/PayMongoWebhookController.php` | Verifies webhook signatures, marks payments as Paid |
| `app/Services/PayMongoService.php` | PayMongo API client for hosted checkout |
| `app/Console/Commands/PayMongoWebhookSync.php` | Automatic ngrok + webhook setup command |
| `resources/js/Pages/client/MenuGallery.jsx` | Client menu exploration |
| `resources/js/Components/client/MenuBuilder.jsx` | Custom package builder |
| `app/Services/BusinessRulesService.php` | Booking availability and pax limits |
| `paymongo-testing.md` | Detailed PayMongo testing guide with all test scenarios |

---

## 🛠️ Troubleshooting

### "Could not find driver" (pgsql)

**Cause:** PostgreSQL extensions are not enabled in PHP.

**Fix:**
1. Open `php/php.ini`
2. Find `extension=pdo_pgsql` and `extension=pgsql`
3. Remove the `;` at the beginning of each line
4. Save and retry

### "Unable to connect securely to PayMongo" (CA Bundle)

**Cause:** The SSL certificate bundle file is missing.

**Fix:**
```powershell
Invoke-WebRequest -Uri "https://curl.se/ca/cacert.pem" -OutFile "storage\app\cacert.pem"
php artisan config:clear
```

### "Prepared statement already exists"

**Cause:** You're using the wrong database port.

**Fix:** Make sure `.env` has `DB_PORT=6543` (not `5432`).

### "Could not find ngrok executable"

**Cause:** `NGROK_PATH` in `.env` is empty or points to the wrong location.

**Fix:**
```powershell
# Find your ngrok path:
where.exe ngrok

# Put the result in .env (use single quotes!):
# NGROK_PATH='C:\Users\YourName\...\ngrok.exe'
```

### Migration fails with "violates check constraint packages_type_check"

**Cause:** An old PostgreSQL CHECK constraint blocking new column values.

**Fix:** This has already been fixed in the codebase. If you still encounter it, run:
```powershell
php artisan migrate:rollback --step=1
php artisan migrate
```

### White screen after login

**Fix:**
```powershell
php artisan optimize:clear
```

### Vite manifest not found

**Fix:** If `composer run dev` is not running, build assets manually:
```powershell
npm run build
```

### PayMongo webhook returns 401 (Invalid Signature)

**Cause:** `PAYMONGO_WEBHOOK_SECRET` doesn't match the actual webhook.

**Fix:**
```powershell
php artisan paymongo:webhook-sync
```

This re-syncs the webhook and updates the secret automatically.

### Payment succeeded on PayMongo but dashboard still shows "Pending"

**Cause:** The webhook didn't reach your app (ngrok stopped, or webhook not synced).

**Fix:**
1. Check ngrok is running: http://127.0.0.1:4040
2. Re-run `php artisan paymongo:webhook-sync`
3. The payment can also be manually verified by the Accounting staff through the admin dashboard

### Test payments not showing in PayMongo Dashboard

**Cause:** You're viewing Live Mode instead of Test Mode.

**Fix:** Toggle to **Test Mode** on the PayMongo Dashboard.

---

## 📝 Quick Reference — All Commands

| When | Command | Purpose |
| :--- | :--- | :--- |
| Every new terminal | `$env:PATH = ".\php;" + $env:PATH` | Enable local PHP |
| One-time | `php composer.phar install` | Install PHP packages |
| One-time | `npm install` | Install JS packages |
| One-time | `Copy-Item .env.example .env` | Create environment file |
| One-time | `php artisan key:generate` | Generate app encryption key |
| One-time | `php artisan migrate --seed` | Create tables + seed data |
| One-time | `Invoke-WebRequest -Uri "https://curl.se/ca/cacert.pem" -OutFile "storage\app\cacert.pem"` | Download SSL certificates |
| One-time | `ngrok config add-authtoken YOUR_TOKEN` | Authenticate ngrok |
| Daily | `composer run dev` | Start all services |
| Daily | `php artisan paymongo:webhook-sync` | Sync webhook (2nd terminal) |
| When needed | `php artisan optimize:clear` | Clear all caches |
| When needed | `php artisan config:clear` | Clear config cache only |

---

*Developed for Eloquente Catering System.*
