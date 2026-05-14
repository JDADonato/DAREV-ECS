**System Context & Tech Stack:**
You are an expert full-stack developer working on the "Eloquente Catering System (ECS)." 
* **Backend:** Laravel 11
* **Frontend:** React via Laravel Inertia.js, styled with Tailwind CSS.
* **Directive:** You must maintain my exact UI design and Tailwind classes. Do not generate generic UI. 

**Mission:**
We need to implement the final remaining features of the system. Because these features span multiple roles and require database/routing updates, we will implement them sequentially in phases. 

Here is the master list of required features:

### PHASE 1: Authentication & Client Profile
* **Email Verification:** After registration, prevent immediate access. Show a pop-up modal requiring an OTP/verification code sent to their email. Upon successful entry, redirect to the client-side landing page.
* **Client Profile Management:** Replace the static "Hello, client" text in the navbar with a clickable profile icon/dropdown. Create a Profile page where the client can update their username, password, and contact information.

### PHASE 2: Real-Time Communication & Notifications
* **Notification Bell (Client):** Add a notification bell icon at the top right of the client layout. This must display system alerts (e.g., "Booking Approved," "Payment Pending," "Payment Approved").
* **Live Chat / Messaging Module:** * *Client Side:* Implement a floating message bubble at the bottom right of the landing page/client portal to communicate with available Marketing Staff.
  * *Marketing Staff Side:* Create a messaging interface where staff can view and reply to active client inquiries in real-time.

### PHASE 3: Payments & Accounting Adjustments
* **Paymongo Integration:** Set up the Laravel service classes, routes, and React components required to integrate Paymongo for processing the 10-70-20 milestone payments.
* **Accounting Audit Log:** Implement an audit trail for the Accounting Staff. Any payment approvals, rejections, or modifications must be logged and visible to all other accounting personnel (showing *who* made the change and *when*).
* **Refund Management Fix:** Update the refund calculation logic. Enforce the strict business rule that **only the downpayment is refundable**, and ensure the UI reflects the real calculated prices based on this rule.

### PHASE 4: Admin & Marketing Enhancements
* **Marketing Inquiries Tab Update:** Modify the Marketing Staff's booking view so they can see the exact food dishes selected by the client, in addition to the existing venue and pax details.
* **Admin Configurations Update:** Update the Admin's "Configurations" tab to allow full CRUD (Create, Read, Update, Delete) operations for Catering Packages (modifying package names, inclusions, and prices).

**Execution Instructions:**
Please acknowledge this entire roadmap. Then, **begin immediately with PHASE 1**. 
1. Provide the necessary Laravel Migrations/Mailable classes for the OTP Email Verification.
2. Provide the updated Laravel Controllers (AuthController / ProfileController).
3. Provide the updated React/Inertia components using my existing Tailwind design. 

Stop after Phase 1 is complete. I will review and prompt you to move on to Phase 2.

---

## Tips for Success with this Prompt:
1. **Phased Approach:** Asking the AI to stop after Phase 1 is critical. If it tries to write the Paymongo integration, WebSockets for the chat, and the Email verification all in one response, it will run out of memory and give you incomplete code.
2. **Paymongo API Keys:** Before starting Phase 3, make sure you have created a free test account on Paymongo so you can paste your `PAYMONGO_PUBLIC_KEY` and `PAYMONGO_SECRET_KEY` into your `.env` file when the AI asks for them!
3. **WebSockets:** For the messaging and notification modules (Phase 2), the AI will likely suggest setting up **Laravel Reverb** or **Pusher**. Just follow its `.env` setup instructions for those tools so the live chat updates without the user needing to refresh the page.