# ⚡ Quick Commands - Credential Management

## 🚀 Create New User Credentials

### Simple Usage:
```bash
./php artisan user:create {username} {password} --role={role}
```

### Examples:

**Create a marketing staff account:**
```bash
./php artisan user:create john_marketing mypassword123 --role=Marketing
```

**Create an accounting staff account:**
```bash
./php artisan user:create jane_accounting securepass456 --role=Accounting
```

**Create an admin account:**
```bash
./php artisan user:create supervisor adminpass789 --role=Admin
```

**Create a client account with email:**
```bash
./php artisan user:create client_name password123 --role=Client --email=client@example.com --phone=+1234567890
```

---

## 📋 Available Roles

| Role | Dashboard | Access Level |
|------|-----------|--------------|
| **Admin** | Admin Dashboard | Full system access |
| **Marketing** | Marketing Dashboard | Event logistics, tasting coordination |
| **Accounting** | Accounting Dashboard | Payments, pricing overrides |
| **Client** | Client Portal | Book events, manage bookings |

---

## 🔑 Your Current Default Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | password123 | Admin |
| marketing | password123 | Marketing |
| accounting | password123 | Accounting |
| client | password123 | Client |

---

## 📝 Additional Options

```bash
# With optional email
--email=user@example.com

# With optional phone
--phone=+1234567890

# Both together
--role=Client --email=user@example.com --phone=+1234567890
```

---

## ✅ Key Points to Remember

1. **All credentials are stored in the database** → They persist across devices
2. **Use these commands to add new staff/clients** → No more lost credentials
3. **Database file: `database/database.sqlite`** → Contains all user data
4. **Share this database across devices** → Use Git, Dropbox, or cloud storage

---

## 🔄 Common Scenarios

### Scenario 1: Adding a new marketing person
```bash
./php artisan user:create marie_events event2024pass --role=Marketing --email=marie@company.com
```
Marie can now login with: **marie_events** / **event2024pass** from any device!

### Scenario 2: Creating multiple test accounts at once
```bash
./php artisan user:create test1 testpass --role=Client
./php artisan user:create test2 testpass --role=Marketing
./php artisan user:create test3 testpass --role=Accounting
```

### Scenario 3: Switching to a different device
1. Sync your `database/database.sqlite` file to the new device
2. Copy the entire project folder to the new device
3. Login with any saved credentials → They'll work immediately!

---

## 🎯 Next Steps

1. ✅ Default users seeded (admin, marketing, accounting, client)
2. ✅ Use `php artisan user:create` to add more credentials
3. ✅ Sync `database/database.sqlite` across devices
4. ✅ Login from any device with your credentials

**Your authentication system is now production-ready!** 🎉
