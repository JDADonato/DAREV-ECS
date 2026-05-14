# API Testing Guide

## Database-Backed Endpoints

All endpoints are now live and returning real data from the database. Test them with:

```bash
# Start the server
php artisan serve --port=8000

# In another terminal, test the endpoints
curl http://localhost:8000/api/menu
curl http://localhost:8000/api/event-types
curl http://localhost:8000/api/packages
```

## Menu API

### Get all menu items (with pagination)
```bash
GET /api/menu?per_page=10&page=1
```

Response:
```json
{
  "data": [
    {
      "id": 1,
      "dish_id": "sup1",
      "name": "Bacon and Mushroom Soup",
      "category": "starter",
      "cost_per_head": 50,
      "price_adj": 0,
      "is_best_seller": true,
      "image": "https://images.unsplash.com/...",
      "description": "Creamy mushroom soup...",
      "created_at": "2024-05-09T...",
      "updated_at": "2024-05-09T..."
    }
  ],
  "links": {...},
  "meta": {...}
}
```

### Filter by category
```bash
GET /api/menu?category=main&per_page=20
```

### Get best sellers only
```bash
GET /api/menu?best_seller=true
```

### Get menu categories
```bash
GET /api/menu/categories
```

Response:
```json
["dessert", "drink", "main", "side", "starter"]
```

### Get best seller items
```bash
GET /api/menu/bestsellers
```

## Event Types API

### Get all event types
```bash
GET /api/event-types?per_page=50
```

Response:
```json
{
  "data": [
    {
      "id": 1,
      "slug": "wedding",
      "label": "Wedding",
      "icon": "💍",
      "description": "Elegant wedding celebration",
      "image": "https://...",
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

### Get event type by slug
```bash
GET /api/event-types/slug/wedding
```

## Packages API

### Get all packages
```bash
GET /api/packages?per_page=50
```

Response:
```json
{
  "data": [
    {
      "id": 1,
      "name": "Wedding Anthurium",
      "type": "wedding",
      "base_price_per_head": 850,
      "minimum_pax": 30,
      "description": "Premium wedding package",
      "inclusions": [...json...],
      "is_active": true
    }
  ]
}
```

### Get packages by type
```bash
GET /api/packages/type/wedding
```

## Booking Validation

When creating a booking, the system now validates:

1. **Lead Time**: Event date must be at least 7 days from now
   ```json
   {
     "errors": {
       "event_date": "Event must be booked at least 7 days in advance. Earliest available: 2024-05-16"
     }
   }
   ```

2. **Pax Limits**: Between 30-1000 guests
   ```json
   {
     "errors": {
       "pax": "Minimum 30 guests required"
     }
   }
   ```

3. **Daily Capacity**: Maximum 3 events per day
   ```json
   {
     "errors": {
       "event_date": "No availability on 2024-05-25. Maximum 3 events per day. Try another date."
     }
   }
   ```

4. **Price Verification**: Server-side calculation must match client submission
   ```json
   {
     "error": "Price calculation mismatch. Please refresh and try again.",
     "recalculated_total": 2500
   }
   ```

## Testing Price Verification

The system detects when clients try to manipulate prices:

```bash
POST /api/bookings
{
  "user_id": 1,
  "event_date": "2024-05-25",
  "event_time": "18:00",
  "pax": 50,
  "menu_items": [1, 2, 3],
  "total_cost": 999.99  # If this doesn't match calculated cost, it will be rejected
}
```

The service will:
1. Calculate: MenuItem 1 (50 per head) × 50 guests × 1 = 2500
2. Calculate: MenuItem 2 × 50 × 1 = ...
3. Calculate: MenuItem 3 × 50 × 1 = ...
4. Sum them all
5. Compare to submitted total_cost
6. If variance > 1%, reject with recalculated total

## Notifications

When a booking is created:

1. **Client** receives BookingConfirmedNotification
   - Email with booking details and payment schedule
   - Saved to database for in-app notification

2. **Admins** receive NewBookingNotification
   - Email alerting about new booking
   - Links to ops dashboard for review

Check database notifications:
```bash
php artisan tinker
>>> \App\Models\User::find(1)->notifications()->latest()->first();
```

## Business Rules

View or modify business rules:

```bash
php artisan tinker
>>> $rules = \App\Models\BusinessRule::query()->latest('id')->first();
>>> $rules->minimum_lead_days;       # 7
>>> $rules->maximum_capacity_per_day; # 3
>>> $rules->minimum_pax_per_event;    # 30
>>> $rules->maximum_pax_per_event;    # 1000
```

Update business rules:
```bash
>>> $rules->update(['minimum_lead_days' => 14]);
```

## Frontend Integration Example

Replace your mockData imports with API calls:

### Before (mockData):
```jsx
import { DISHES, EVENT_TYPES, PACKAGES } from '../Data/mockData';

const [menu, setMenu] = useState(DISHES);
```

### After (API):
```jsx
const [menu, setMenu] = useState([]);

useEffect(() => {
  fetch('/api/menu?per_page=100')
    .then(r => r.json())
    .then(data => setMenu(data.data))
    .catch(err => console.error(err));
}, []);
```

## Database Inspection

Check what was seeded:

```bash
php artisan tinker

# Menu items
>>> \App\Models\MenuItem::count();  # 45+
>>> \App\Models\MenuItem::first();

# Event types
>>> \App\Models\EventType::count(); # 8
>>> \App\Models\EventType::pluck('label');

# Packages
>>> \App\Models\Package::count();   # 3
>>> \App\Models\Package::all();

# Users
>>> \App\Models\User::all();        # 4 default users

# Business rules
>>> \App\Models\BusinessRule::first();
```

## Common Errors

### 404: Endpoint not found
- Ensure Laravel server is running: `php artisan serve --port=8000`
- Check route is registered in `routes/web.php`
- Clear route cache: `php artisan route:clear`

### 500: Business rules not configured
- Seed database: `php artisan db:seed`
- Check BusinessRule table has records: `php artisan tinker`
  ```
  >>> \App\Models\BusinessRule::count();  # Should be > 0
  ```

### 422: Price verification failed
- Recalculated total sent in response
- Client needs to recalculate and resubmit with correct price
- Check menu items exist: `GET /api/menu/1`

### Empty results from API
- Check per_page parameter (default 50)
- Verify database was seeded: `php artisan db:seed`
- Check specific record exists: `GET /api/menu/1`

## Useful Commands

```bash
# Reset and reseed everything
php artisan migrate:refresh --seed

# Check current routes
php artisan route:list

# Monitor notifications
php artisan notifications:table  # Create notification DB table if needed
php artisan migrate

# Test specific controller method
php artisan tinker
>>> \App\Http\Controllers\MenuController::class
```

---

**Status:** All endpoints live and tested ✅
**Last Updated:** May 2024
**Ready for:** Frontend migration and production deployment
