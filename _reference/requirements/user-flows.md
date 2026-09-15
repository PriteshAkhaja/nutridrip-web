# Nutridrip User Flows

## Overview
Nutridrip is an IV therapy management platform connecting patients, doctors, nurses, clinics, and administrators.

---

## 1. SUPER ADMIN

**Entry:** `/login` → Role: `superadmin` or `admin`

### 1.1 Authentication Flow
```
Login Page → Enter credentials → Validate → Redirect to /dashboard/admin
```

### 1.2 Dashboard Overview
```
Dashboard → View platform stats:
  - Total Patients
  - Active Doctors
  - Partner Clinics
  - Pending Approvals
  - Revenue
```

### 1.3 User Management Flow
```
Dashboard → Manage Users (/dashboard/admin/manage)
  ├── View All Users (Patients, Doctors, Nurses, Clinics)
  ├── Add New User
  │   └── Select Role → Enter Details → Save
  ├── Edit User
  │   └── Select User → Modify Details → Update
  └── Deactivate User
      └── Select User → Confirm → Deactivate
```

### 1.4 Inventory Management Flow
```
Dashboard → Inventory (/dashboard/admin/inventory)

  VIEW 1: Inventory
  ├── View Products & Batch Lots
  ├── Filter: Products Tab | Batches Tab
  ├── Search by drug name, HSN code, molecule
  ├── Filter by category: All | Drugs | Fluids | Consumables | Pre-meds
  ├── View stock levels per product
  └── View batch details (expiry, quantity, manufacturer)

  VIEW 2: Drip Builder
  ├── View Drip Library
  ├── Create New Drip
  │   ├── Enter drip name & description
  │   ├── Add Ingredients
  │   │   ├── Select product
  │   │   ├── Enter dose & unit
  │   │   └── Set role (Active | Fluid | Pre-med | Additive)
  │   ├── Add infusion notes
  │   ├── Toggle "Include Kit" (IV set, cannula, etc.)
  │   └── Save drip
  ├── View existing drip details
  └── Activate/Deactivate drips

  VIEW 3: Availability Calculator
  ├── Select drip from library
  ├── Enter quantity needed
  ├── Toggle "Include Kit"
  ├── Click "Check Availability"
  └── View results:
      ├── Theoretical: max drips without wastage
      ├── Realistic: after accounting for vial waste
      ├── Wastage: estimated product waste
      └── Bottleneck: limiting ingredient

  VIEW 4: Orders
  ├── View all orders with status tabs
  ├── Filter: All | Draft | Confirmed | Dispatched | Cancelled
  ├── Create New Order
  │   ├── Select/create patient
  │   ├── Add drip items
  │   │   ├── Select drip
  │   │   ├── Enter quantity
  │   │   └── Toggle "With Kit"
  │   ├── Review order summary
  │   └── Save as Draft or Confirm
  └── Update order status

  VIEW 5: Alerts
  ├── View expiry alerts (batches expiring within 30 days)
  ├── View low stock alerts (below reorder level)
  ├── View reorder alerts
  ├── View out of stock alerts
  └── View recall alerts
```

### 1.5 AI Model Studio Flow
```
Dashboard → Studio (/dashboard/admin/studio)
  ���── View AI Models
  ├── Create New Model
  │   ├── Enter model name
  │   ├── Configure parameters
  │   └── Train model
  └── Manage existing models
```

---

## 2. ADMIN

**Entry:** `/login` → Role: `admin`

### 2.1 Authentication Flow
```
Login Page → Enter credentials → Validate → Redirect to /dashboard/admin
```

### 2.2 Dashboard Overview
```
Dashboard → View:
  - Total Patients
  - Active Doctors
  - Partner Clinics
  - Pending Approvals count
```

### 2.3 Approval Flow
```
Dashboard → View Pending Approvals
  ├── Review approval request
  ├── View patient/doctor details
  ├── Approve → Grant access
  └── Reject → Deny with reason
```

### 2.4 Clinic Management Flow
```
Dashboard → View Clinics
  ├��─ View clinic details
  ├── View clinic orders
  ├── View clinic bookings
  └── Update clinic status
```

---

## 3. DOCTOR

**Entry:** `/login` → Role: `doctor`

### 3.1 Authentication Flow
```
Login Page → Enter credentials → Validate → Redirect to /dashboard/doctor
```

### 3.2 Dashboard Overview
```
Dashboard → View:
  - Pending Approvals (patient quizzes to review)
  - Active Plans count
  - This Week's Sessions count
  - Total Patients count
```

### 3.3 Patient Health Quiz Review Flow
```
Dashboard → Pending Approvals
  ├── View patient quiz results
  ├── Review vitality score & concerns
  ├── Click "Approve" → Patient can book sessions
  └── Click "Reject" → Notify patient
```

### 3.4 Treatment Plan Creation Flow
```
Dashboard → Create Plan
  ├── Search/select patient
  ├── Create New Plan
  │   ├── Enter patient details
  │   │   ├── Name, Age, Gender
  │   │   ├── Diagnosis/Primary concern
  │   │   ├── Height, Weight
  │   │   └── Blood Group
  │   ├── Set plan duration
  │   │   ├── Start date
  │   │   └── Number of weeks
  │   ├── Add weekly sessions
  │   │   ├── Select day of week
  ��   │   └── Add drip components:
  │   │       ├── Drip name
  │   │       ├── Dose & unit
  │   │       ├── Route (IV Drip NS | IV Drip RL | IV Push | IM Injection)
  │   │       └── Carrier fluid
  │   └── Add session notes
  ├── Preview Rx slip
  ├── Print Rx slip
  └── Share with Nurse
      └── Select nurse → Send plan
```

### 3.5 Plan Management Flow
```
Dashboard → View Plans
  ├── View active plans
  ├── Edit plan details
  ├── Add/modify weekly sessions
  ├── Toggle "Share with Nurse"
  └── Archive completed plans
```

### 3.6 Rx Slip Flow
```
View Plan → Print Rx
  ├── Generate Rx slip
  │   ├── Patient info
  │   ├── Doctor info
  │   ├── Treatment schedule
  │   └── Drip components
  └── Print/Save as PDF
```

---

## 4. NURSE

**Entry:** `/login` → Role: `nurse`

### 4.1 Authentication Flow
```
Login Page → Enter credentials → Validate → Redirect to /dashboard/nurse
```

### 4.2 Dashboard Overview
```
Dashboard → View:
  - Pending Preparations count
  - Today's Sessions count
  - Total Infusions count
  - Completed count
```

### 4.3 Treatment Preparation Flow
```
Dashboard → View Orders
  ├── View incoming treatment orders (from doctors)
  ├── Select order to prepare
  │   ├── View patient details
  │   ├── View drip components
  │   ├── View checklist
  │   │   ├── □ Verify patient identity
  │   │   ├── □ Check vital signs
  │   │   ├── �� Confirm drip配方
  │   │   ├── □ Gather supplies
  │   │   ├── □ Prepare IV line
  │   │   ���── □ Prime tubing
  │   │   └── □ Set flow rate
  │   └── Mark items complete as prepared
  └── Submit preparation
```

### 4.4 Session Completion Flow
```
Preparation → Start Session
  ├── Administer drip to patient
  ├── Monitor patient
  ├── Complete session
  │   ├── Record any observations
  │   ├── Note any adverse reactions
  │   └── Mark session complete
  └── Order fulfilled
```

### 4.5 Order History Flow
```
Dashboard → Order History
  ├── View past orders
  ├── Filter by status: Pending | In Progress | Completed
  └── View order details
```

---

## 5. CLINIC

**Entry:** `/login` → Role: `clinic`

### 5.1 Authentication Flow
```
Login Page → Enter credentials → Validate → Redirect to /dashboard/clinic
```

### 5.2 Dashboard Overview
```
Dashboard → View:
  - Active Orders (amount)
  - Pending Orders count
  - Total Bookings count
  - Revenue (completed sessions)
```

### 5.3 Order Management Flow
```
Dashboard → View Orders (/dashboard/clinic#orders)
  ├── View all clinic orders
  ├── Filter by status
  ├── View order details
  └── Track order status
```

### 5.4 Booking Management Flow
```
Dashboard → View Bookings
  ├── View all clinic bookings
  ├── Filter: Upcoming | Past | All
  ├── View booking details
  ��   ├── Patient info
  │   ├── Treatment type
  │   ├── Scheduled date/time
  │   └── Status
  └── Update booking (if applicable)
```

### 5.5 Clinic Profile Flow
```
Dashboard → View Profile
  ├── View clinic info:
  │   ├── Name
  │   ├── Location
  │   ├── Partnership status
  │   ├── Partner since date
  │   └── Monthly volume target
  └── Contact support
```

---

## 6. PATIENT

**Entry:** `/login` ��� Role: `patient`

### 6.1 Authentication Flow
```
Login Page → Enter credentials → Validate → Redirect to /dashboard/patient
```

### 6.2 First-Time Patient Flow (Health Quiz)
```
Dashboard → Health Quiz
  ├── Welcome screen
  ├── Quiz Sections:
  │   ├── Personal Info
  │   │   ├── Name
  │   │   ├── Date of Birth
  │   │   ├── Blood Group
  │   │   ├── Phone
  │   │   └── Address
  │   ├── Emergency Contact
  │   │   ├── Contact name
  │   │   └── Contact phone
  │   ├── Medical History
  │   │   ├── Allergies
  │   │   ├── Chronic conditions
  │   │   ├── Current medications
  │   │   ├── Past surgeries
  │   │   └── Family history
  │   ├── Lifestyle
  │   │   ├── Sleep patterns
  │   │   ├── Diet
  │   │   ├── Exercise
  │   │   └── Stress levels
  │   └── Goals & Concerns
  │       ├── Primary concern
  │       ├── Desired outcomes
  │       └── Energy levels
  ├── Calculate vitality score
  └── Submit for doctor review
      └── Status: Pending Approval
```

### 6.3 Session Booking Flow (After Quiz Approval)
```
Dashboard → Book Session
  ├── Select treatment type
  ├── Choose date & time
  ├── Confirm booking
  └── View confirmation
```

### 6.4 Upcoming Sessions Flow
```
Dashboard → Upcoming Sessions
  ├── View scheduled sessions
  ├── View session details:
  │   ├── Date & time
  │   ├── Treatment type
  │   ├── Location
  │   └── Assigned nurse
  └── Cancel session (if allowed)
```

### 6.5 Session History Flow
```
Dashboard → History
  ├── View completed sessions
  ├── View session details
  │   ├── Date
  │   ├── Treatment received
  │   ├── Vitality improvement
  │   └── Notes
  └── Download receipt (if available)
```

### 6.6 Lab Reports Flow
```
Dashboard → Lab Reports
  ├── View uploaded reports
  ├── Upload new report
  │   ├── Select file
  │   ├── Add category
  │   ├── Add notes
  │   └── Upload
  └── View report details
```

### 6.7 Profile Management Flow
```
Dashboard → My Profile
  ├── View personal info
  ├── Edit details
  │   ├── Update contact info
  │   ├── Update medical history
  │   └── Update emergency contact
  └── View health summary
```

---

## Data Flow Summary

```
PATIENT                    DOCTOR                    NURSE
   │                          │                        │
   ├─ Completes quiz ────────>│                        │
   │                          │                        │
   │                          ├─ Reviews & approves ───>│
   │                          │                        │
   │                          ├─ Creates treatment ───>│
   │                          │    plan                │
   │                          │                        │
   │<───── Views plan ────────┤                        │
   │                          │                        │
   │                          │                        ├─ Prepares drip
   │                          │                        │
   ├─ Books session ─────────>│                        │
   │                          │                        │
   │<───── Attends ───────────────────────────────────>│
   │                          │                        │
   │<───── Session complete ──────────────���────────────┤
   │                                                        │
CLINIC                     ADMIN                      SUPER ADMIN
   │                          │                        │
   ├─ Places orders ─────────>│                        │
   │                          │                        │
   │                          ├─ Manages inventory ────>│
   │                          │    & users             │
   │                          │                        │
   └──────────────────────────┴────────────────────────>│
```

---

## Role Permissions Matrix

| Feature                  | Super Admin | Admin | Doctor | Nurse | Clinic | Patient |
|--------------------------|-------------|-------|--------|-------|--------|---------|
| View dashboard           | ✓           | ✓     | ✓      | ✓     | ✓      | ✓       |
| Manage users            | ✓           | ✓     | -      | -     | -      | -       |
| Manage inventory        | ✓           | -     | -      | -     | -      | -       |
| Create drip formulas    | ✓           | -     | -      | -     | -      | -       |
| View inventory alerts   | ✓           | -     | -      | -     | -      | -       |
| Approve patients        | ✓           | ✓     | ✓      | -     | -      | -       |
| Create treatment plans  | -           | -     | ✓      | -     | -      | -       |
| Prepare drips           | -           | -     | -      | ✓     | -      | -       |
| Complete sessions       | -           | -     | -      | ✓     | -      | -       |
| View orders             | ✓           | ✓     | ✓      | ✓     | ✓      | -       |
| Place orders            | -           | -     | -      | -     | ✓      | -       |
| Book sessions          | -           | -     | -      | -     | -      | ���       |
| Complete health quiz    | -           | -     | -      | -     | -      | ✓       |
| Upload lab reports      | -           | -     | -      | -     | -      | ✓       |
