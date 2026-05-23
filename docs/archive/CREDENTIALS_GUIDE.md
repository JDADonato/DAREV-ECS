# 🔐 Credentials Management Guide - Eloquente Catering System

## ✅ Your Persistent Login Credentials

The system is now configured with **database-backed authentication** that persists across all devices. Your default credentials are:

### Default Accounts (Pre-Seeded)
| Username | Password | Role | Use Case |
|----------|----------|------|----------|
| **admin** | password123 | Admin | Full system access, admin dashboard |
| **marketing** | password123 | Marketing | Marketing dashboard, ops management |
| **accounting** | password123 | Accounting | Finance dashboard, payment tracking |
| **client** | password123 | Client | Client portal, booking management |

---

## 🌐 How It Works (Across Devices)

1. **All credentials are stored in the database (`database/database.sqlite`)**
   - Not stored locally (no localStorage/sessionStorage)
   - Not lost when switching devices
   - Persistent across browser sessions

2. **Session Management**
   - Laravel handles sessions via database
   - Sessions are stored in `database/database.sqlite` (sessions table)
   - Browser cookies maintain connection without re-entering credentials

3. **Database Sharing**
   - If syncing the `database/database.sqlite` file across devices (via cloud/Git), credentials will be accessible

---

## 🔄 Adding New Credentials

### Option 1: Using Artisan Command (Recommended)
Run this command to create a new user:

```bash
php artisan tinker
```

Then in the interactive shell:
```php
App\Models\User::create([
    'username' => 'newuser',
    'password' => 'password123',
    'role' => 'Client',  // or 'Admin', 'Marketing', 'Accounting'
    'email' => 'user@example.com',
    'phone' => '+1234567890'
]);
```

### Option 2: DatabaseSeeder (For Bulk Updates)
Edit `database/seeders/DatabaseSeeder.php` and add users to the array, then run:

```bash
php artisan migrate:fresh
php artisan db:seed
```

⚠️ **WARNING**: This will reset all data!

### Option 3: Laravel Console Command
Create a permanent command by running:

```bash
php artisan make:command CreateUser
```

Then implement it for repeated use.

---

## 🚀 Testing Credentials

1. Start your servers (if not already running):
   ```bash
   # Terminal 1 - Backend
   $env:PATH = ".\php;" + $env:PATH; php artisan serve

   # Terminal 2 - Frontend
   npm run dev
   ```

2. Go to: **http://127.0.0.1:8000**
3. Click **Login**
4. Use any credentials from the table above
5. You'll be redirected to your role's dashboard

---

## 🔒 Security Notes

1. **Change Default Passwords in Production**
   - Never use 'password123' in production
   - Use strong, unique passwords for each role

2. **Change via Update Query**
   ```php
   php artisan tinker
   App\Models\User::where('username', 'admin')->update(['password' => Hash::make('new_secure_password')]);
   ```

3. **Sync Database Across Devices**
   - Commit `database/database.sqlite` to Git (if it's not in `.gitignore`)
   - Or use cloud sync (Dropbox, Drive, OneDrive)
   - Or manually transfer the file

---

## ❓ Troubleshooting

### Credentials Still Disappearing?
- ✓ Check that database migrations ran successfully
- ✓ Verify `database/database.sqlite` exists
- ✓ Run `php artisan db:seed` again to ensure users are created
- ✓ Check database file is being synced across devices

### Password Issues?
- Reset any user's password:
  ```php
  php artisan tinker
  \$user = App\Models\User::where('username', 'admin')->first();
  \$user->password = 'newpassword123';
  \$user->save();
  ```

### Need to View All Users?
```php
php artisan tinker
App\Models\User::all(['id', 'username', 'role', 'email'])->toArray();
```

---

## 📱 Multi-Device Sync Strategy

For seamless credential access across devices, use one of these approaches:

1. **GitHub**: Commit database to private repo (if not in `.gitignore`)
2. **Cloud Storage**: Sync `database/` folder via Dropbox/OneDrive
3. **Shared Server**: Deploy to a central server all devices connect to
4. **Database URL**: Use remote database instead of SQLite

---

## ✨ Your System is Secure!

Your credentials are now:
- ✅ Stored persistently in the database
- ✅ Protected with hashed passwords (Laravel's password hashing)
- ✅ Managed by Laravel's session system
- ✅ Ready for multi-device use

Start using your credentials from any device! 🎉
