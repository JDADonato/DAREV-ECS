# JDADonato/CATERING - System Analysis & Handoff Report

This document outlines the current state of the **Eloquente Catering System (ECS)**, highlighting features still in simulation, potential security risks, and the remaining roadmap for production readiness.

## 🚀 System Status: Production vs. Simulation

### 1. Payment Processing (SIMULATED)
*   **Current State:** The `PaymentController` uses a "Secure Checkout" simulation. It generates a temporary signed internal route instead of a real PayMongo Checkout Session.
*   **Production Requirement:**
    *   Integrate PayMongo API for session creation.
    *   Implement a robust Webhook handler to process `payment.paid` events.
    *   Verify webhook signatures to prevent spoofing.
*   **Risk:** Currently, anyone can "pay" by simply visiting the success route or manually updating the database.

### 2. Live Chat & Notifications (PARTIAL)
*   **Current State:** UI components for a notification bell and floating chat bubble exist. However, real-time backend broadcasting (via Laravel Reverb or Pusher) needs full end-to-end verification.
*   **Production Requirement:**
    *   Ensure WebSockets are correctly configured in the production environment.
    *   Implement the Marketing-side chat interface to reply to client inquiries.

### 3. Email & Communication (MISSING)
*   **Current State:** No automated emails are sent. The system collects contact info but does not utilize it.
*   **Production Requirement:**
    *   **Phase 1 Priority:** Email OTP (One-Time Password) verification during registration to prevent bot accounts.
    *   Booking confirmation, approval alerts, and payment reminders.

### 4. Inventory & Analytics (SIMULATED)
*   **Current State:** The Admin Dashboard includes "Inventory" and "Analytics" tabs, but they currently display static or partially simulated data.
*   **Production Requirement:**
    *   Link "Dishes" to "Ingredients/Stock" for real-time inventory depletion upon booking.
    *   Generate real revenue and operational reports based on database records.

---

## ⚠️ Critical Risks & Logic Gaps

### 1. Client-Side Price Calculation (SECURITY RISK)
*   **Issue:** The `MenuBuilder` and `MenuGallery` components calculate the `totalCost` in the browser and send it to the backend.
*   **Problem:** A malicious user could modify the `totalCost` value in the network request to pay a lower price (e.g., set a ₱50,000 package to ₱1).
*   **Fix:** The backend **MUST** independently re-calculate the total price based on the submitted dish IDs and current database prices during the booking submission.

### 2. Lack of Booking Lead Time
*   **Issue:** Users can currently book an event for "tomorrow" if the slot is open.
*   **Problem:** Operations cannot handle a 100-pax event with only 24 hours' notice.
*   **Fix:** Implement a "Lead Time" rule (e.g., minimum 7–14 days before the event date) in the `CalendarView` and backend validation.

### 3. Refund Logic Hardcoding
*   **Issue:** Refund calculations need to strictly follow the "Only Downpayment is Refundable" rule.
*   **Risk:** Inconsistent UI/UX where users might see different refund estimates than what is actually processed.

---

## 🛠️ Remaining Roadmap (Darev's Handoff)

### PHASE 1: Authentication & Client Profile
*   [ ] **OTP Email Verification:** Block dashboard access until the user verifies their email via a 6-digit code.
*   [ ] **Profile Management:** Allow clients to update their name, password, and contact details from a dedicated Profile page.

### PHASE 2: Real-Time Communication
*   [ ] **Notification Bell:** Functional alerts for booking status changes (Pending -> Approved).
*   [ ] **Live Chat:** Staff-to-Client real-time messaging module.

### PHASE 3: Payments & Accounting
*   [ ] **PayMongo Integration:** Replace simulated checkout with real credit card/GCash/Maya processing.
*   [ ] **Accounting Audit Log:** Track *who* approved a payment and *when* to prevent internal fraud.
*   [ ] **Refund Management:** Implement the official refund calculation engine.

### PHASE 4: Admin & Operations
*   [ ] **Package CRUD:** Allow Admins to create/edit/delete catering packages (currently semi-static).
*   [ ] **Dish-to-Booking View:** Allow Marketing Staff to see the specific dishes selected by a client in their booking details.
*   [ ] **Inventory Tracking:** Link dish selection to ingredient stock levels.

---

## 📝 Immediate Recommendations
1.  **Move Price Calculation to Backend:** Immediately update the Booking Controller to ignore the `totalCost` sent by the frontend and calculate it itself.
2.  **Verify Supabase RLS:** Ensure that the Row Level Security policies on Supabase are strictly preventing Clients from seeing other Clients' bookings.
3.  **Setup Mailtrap/Postmark:** Configure a mail driver to begin testing Phase 1 (Email Verification).
