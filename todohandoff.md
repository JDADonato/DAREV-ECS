# 📝 TODO: System Readiness Handoff

This document lists the **critical tasks** that must be completed to transition the Eloquente Catering System (ECS) from a simulated prototype to a production-ready application. 

> [!IMPORTANT]
> These items must be addressed before any new features (e.g., advanced analytics, mobile app versions) are implemented.

---

## 🛡️ 1. Security & Logic Integrity (Highest Priority)
These items fix fundamental flaws that could lead to financial loss or operational failure.

- [ ] **Server-Side Price Validation:** 
    - Currently, the frontend sends the `totalCost` to the backend. This is a security risk.
    - **Action:** Modify the Booking Controller to re-calculate the total price based on the `dish_ids` and package prices stored in the database. Ignore the price sent by the client.
- [ ] **Booking Lead Time Enforcement:**
    - Users can currently book for dates that are too close (e.g., tomorrow).
    - **Action:** Implement a minimum lead time (e.g., 7–14 days) in both the frontend calendar and backend validation.
- [ ] **Supabase RLS Audit:**
    - Verify that Row Level Security (RLS) is strictly enforced so Clients cannot access or modify bookings belonging to other users.

## ✨ 2. Journey & UI Integrity (Completed May 16)
- [x] **Journey Tracker Synchronization:**
    - Synced 6-step flow across Homepage and Client Dashboard.
- [x] **Marketing Approval Workflow:**
    - Implemented UI-level gates that lock payments until approval is granted.
- [x] **Premium UI/UX Overhaul:**
    - Modernized the supplementary details and menu selection modules.

## 🔑 3. Authentication & Profile (Phase 1)
- [ ] **OTP Email Verification:**
    - Prevent users from accessing the dashboard until they have verified their email via a 6-digit code.
- [ ] **Functional Profile Management:**
    - Replace the static "Hello, client" text with a real profile dropdown.
    - Enable clients to update their username, password, and contact details.

## 💳 4. Payments & Accounting (Phase 3)
- [ ] **Production PayMongo Integration:**
    - Replace the current "Simulation Success" route with a real PayMongo Checkout Session.
    - Implement a Webhook handler to listen for `payment.paid` events and update the database status automatically.
- [ ] **Accounting Audit Log:**
    - Log every manual status change (Approval/Rejection) made by staff members.

## 💬 5. Real-Time Communication (Phase 2)
- [ ] **Live Notification System:**
    - Make the notification bell functional using Laravel Reverb or Pusher.
    - Alert users when their booking status changes (e.g., Pending -> Approved).
- [ ] **Staff-Client Chat:**
    - Connect the floating chat bubble on the client side to a real backend messaging module.
    - Create the "Marketing Staff" interface to respond to these inquiries.

## 📦 6. Admin & Operations (Phase 4)
- [ ] **Full Package CRUD:**
    - Allow Admins to create and edit catering packages (names, inclusions, and prices) via the UI instead of manual database entry.
- [ ] **Detailed Booking View for Marketing:**
    - Update the inquiries tab to show the specific dishes selected by the client.

---

## 🚦 Next Steps for the Reader
1. **Start with the Security Fix:** Fix the price calculation logic first.
2. **Setup Mailtrap:** Configure an SMTP service to test the Email OTP flow.
3. Review `darevhandoff.md` and `REMAINING_FEATURES.md`: For a deeper dive into the "Simulation vs. Production" gaps and the detailed phased implementation plan.

