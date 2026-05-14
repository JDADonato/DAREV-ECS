# Eloquente Catering System - Technical Audit & Roadmap

This document provides a detailed scan of the current system, identifying missing features, logic gaps, and immediate requirements for further progress.

## 🔍 System Gaps (What's Missing)

### 1. Full Database Synchronization
*   **Current State**: The system relies heavily on `resources/js/data/mockData.js` for event types, packages, and core dishes.
*   **Gap**: Changes made in the Admin Dashboard (e.g., editing a dish price) may not reflect globally if the frontend is still pulling from the static mock file.
*   **Requirement**: Move all data from `mockData.js` into Laravel Seeders and update all components to fetch this data via API.

### 2. Real Payment Processing
*   **Current State**: A `Payment` model and database table exist, but they only record data manually entered by staff.
*   **Gap**: No integration with payment gateways (PayMongo, GCash, PayPal, etc.).
*   **Requirement**: Implement a webhook-based payment flow for automated booking approvals upon downpayment.

### 3. Business Logic & Constraints
*   **Current State**: Users can pick any date and any number of pax.
*   **Gap**: No "Lead Time" rule (e.g., prevents booking an event for tomorrow). No "Capacity" rule (e.g., prevents 10 bookings on the same day if the team can only handle 3).
*   **Requirement**: Add backend validation to check for date availability and minimum lead time requirements.

### 4. Communication Layer
*   **Current State**: The system collects client contact info but does nothing with it.
*   **Gap**: No automated email or SMS notifications for booking confirmations, approval alerts, or payment receipts.
*   **Requirement**: Integrate Laravel Mail/Notifications for client and admin alerts.

---

## 🛠️ Logic & Functional Errors

### 1. Client-Side Price Calculation
*   **Problem**: Currently, the "Total Cost" of custom packages is calculated in the browser (`MenuGallery.jsx`).
*   **Risk**: A tech-savvy user could technically modify the total price in the browser's console before submitting.
*   **Fix**: The backend must independently re-calculate the total price based on the selected dish IDs during the booking submission process.

### 2. Inventory vs. Menu
*   **Problem**: There is no link between "Dishes" and "Ingredients/Stock".
*   **Risk**: The system allows booking dishes even if ingredients are unavailable.
*   **Fix**: (Optional but recommended) Add a basic inventory tracking module for key ingredients.

### 3. Role-Based Access Control (RBAC) Hardcoding
*   **Problem**: Dashboard redirections are often hardcoded in the frontend (e.g., `if (user.role === 'Admin') ...`).
*   **Risk**: If a new role is added, many frontend files must be updated.
*   **Fix**: Move the "Home Route" logic to the backend User model or Auth response.

---

## 🚀 Pre-requisites for Further Progress

1.  **Data Seeding**: Populate the actual database with the 50+ dishes currently in `mockData.js`.
2.  **API Migration**: Replace `import { DISHES } from ...` with `useEffect` fetch calls in all gallery and builder components.
3.  **Booking Validation**: Implement the `BookingRequest` validation class in Laravel to enforce lead times and minimum pax requirements before further UI work.
4.  **Admin UI Polish**: Complete the "Inventory" and "Analytics" tabs in the Admin Dashboard, which are currently showing partial/simulated data.

---

## 📈 Roadmap Recommendation

1.  **Phase 1**: Total Mock-to-Database migration (Data Integrity).
2.  **Phase 2**: Backend Price Validation & Business Rules (Security & Policy).
3.  **Phase 3**: Automated Notifications & Payments (Automation).
4.  **Phase 4**: Inventory & Advanced Analytics (Operations).
