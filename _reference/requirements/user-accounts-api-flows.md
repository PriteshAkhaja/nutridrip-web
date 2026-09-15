# Nutridrip User Accounts, APIs & Data Flows

Complete documentation of all user roles, features, API connections, user flows, and data flows.

---

## Table of Contents
1. [User Roles Overview](#1-user-roles-overview)
2. [User Accounts & Features](#2-user-accounts--features)
3. [API Architecture](#3-api-architecture)
4. [User Flows](#4-user-flows)
5. [Data Flows](#5-data-flows)
6. [Database Schema](#6-database-schema)
7. [Role Permissions Matrix](#7-role-permissions-matrix)

---

## 1. User Roles Overview

| Role | Code | Description |
|------|------|-------------|
| Super Admin | `superadmin` | Full platform control, user management, inventory |
| Admin | `admin` | Platform operations, approvals |
| Doctor | `doctor` | Treatment planning, patient management |
| Nurse | `nurse` | Treatment execution, infusion preparation |
| Clinic | `clinic` | Partner clinic operations, bookings |
| Patient | `patient` | End user, health quiz, booking |

---

## 2. User Accounts & Features

### 2.1 SUPER ADMIN / ADMIN

**Access:** `/dashboard/admin`
**Role Codes:** `superadmin`, `admin`

#### Features:
| Feature | Module | Description |
|---------|--------|-------------|
| Dashboard | Core | Platform stats, revenue, user counts |
| User Management | Manage | CRUD all users (patients, doctors, nurses, clinics) |
| Inventory | Inventory | Products, batches, drip builder, availability |
| AI Studio | Studio | Configure AI models |
| Approvals | Dashboard | Review pending requests |

#### Demo Credentials:
```
Email: admin@nutridrip.com
Password: admin123
```

#### Data Model:
```typescript
{
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: "superadmin" | "admin";
  permissions: string[]; // JSON array
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 2.2 DOCTOR

**Access:** `/dashboard/doctor`
**Role Code:** `doctor`

#### Features:
| Feature | Module | Description |
|---------|--------|-------------|
| Dashboard | Core | Patient stats, pending quizzes |
| Health Quizzes | Quiz | Review patient vitality assessments |
| Treatment Plans | TxBuilder | Create multi-week IV therapy plans |
| Sessions | TxBuilder | Configure drip components, doses, routes |
| Share Plans | TxBuilder | Send plans to nurses for execution |

#### Demo Credentials:
```
Email: dr.sarah@nutridrip.com
Password: doctor123
```

#### Data Model:
```typescript
{
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: "doctor";
  specialization?: string;
  licenseNo?: string;
  createdAt: Date;
}
```

#### Treatment Plan Structure:
```typescript
{
  id: string;
  patientName: string;
  patientAge: string;
  diagnosis: string;
  startDate: string;
  totalWeeks: number;
  weeks: [
    {
      weekNum: number;
      sessions: [
        {
          id: string;
          date: string;
          dripName: string;
          components: [
            {
              id: string;
              name: string;
              dose: string;
              unit: string;
              route: "IV Drip in NS" | "IV Drip in RL" | "IV Push/Bolus" | "IM Injection" | "Add to Drip Bag" | "Oral";
              carrier: string;
            }
          ];
          sessionNotes: string;
        }
      ];
    }
  ];
  sharedWithNurse: boolean;
  doctorName: string;
}
```

---

### 2.3 NURSE

**Access:** `/dashboard/nurse`
**Role Code:** `nurse`

#### Features:
| Feature | Module | Description |
|---------|--------|-------------|
| Dashboard | Core | Order stats, today's tasks |
| Infusion Orders | Orders | View assigned treatment plans |
| Infusion Checklist | Checklist | Prepare drips step-by-step |
| Complete Sessions | Orders | Mark treatments done |

#### Demo Credentials:
```
Email: nurse.emma@nutridrip.com
Password: nurse123
```

#### Data Model:
```typescript
{
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: "nurse";
  licenseNo?: string;
  assignedTo?: string; // clinic ID
  createdAt: Date;
}
```

#### Infusion Order Structure:
```typescript
{
  id: string;
  patientName: string;
  dripName: string;
  scheduledAt: string;
  status: "pending" | "in-progress" | "completed" | "cancelled";
  location: "home" | "clinic" | "office" | "hotel";
  notes?: string;
  nurseAssigned: string | null;
  checklist: string[]; // preparation steps
}
```

---

### 2.4 CLINIC

**Access:** `/dashboard/clinic`
**Role Code:** `clinic`

#### Features:
| Feature | Module | Description |
|---------|--------|-------------|
| Dashboard | Core | Orders, revenue, bookings stats |
| Orders | Orders | View clinic orders |
| Bookings | Bookings | View patient appointments |
| Profile | Profile | View clinic info |

#### Demo Credentials:
```
Email: clinic@healthfirst.com
Password: clinic123
```

#### Data Model:
```typescript
{
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: "clinic";
  address?: string;
  location?: string;
  status: "active" | "inactive" | "pending";
  partnersSince?: Date;
  monthlyVolume?: number;
}
```

#### Clinic Order Structure:
```typescript
{
  id: string;
  orderedAt: string;
  items: string; // e.g., "Velocity × 5, Cognitas × 6"
  amount: number;
  status: "pending" | "processing" | "dispatched" | "delivered" | "cancelled";
  scheduledDelivery?: Date;
}
```

---

### 2.5 PATIENT

**Access:** `/dashboard/patient`
**Role Code:** `patient`

#### Features:
| Feature | Module | Description |
|---------|--------|-------------|
| Dashboard | Core | Upcoming sessions, vitality score |
| Health Quiz | Quiz | Complete vitality assessment |
| Book Session | Book | Schedule appointment |
| Lab Reports | Lab | Upload medical documents |
| Profile | Profile | Update health info |

#### Demo Credentials:
```
Email: patient@example.com
Password: patient123
```

#### Data Model:
```typescript
{
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: "patient";
  dob?: string;
  bloodGroup?: string;
  address?: string;
  emergencyContact?: string;
  allergies?: string;
  chronicConditions?: string;
  currentMedications?: string;
  surgeries?: string;
  familyHistory?: string;
  lifestyleNotes?: string;
  vitalityScore?: number;
  createdAt: Date;
}
```

#### Health Quiz Structure:
```typescript
{
  id: string;
  patientId: string;
  responses: {
    energy: number; // 1-10
    sleep: number; // 1-10
    stress: number; // 1-10
    nutrition: number; // 1-10
    exercise: number; // 1-10
    hydration: number; // 1-10
  };
  vitalityScore: number; // calculated average
  recommendations: string[];
  createdAt: Date;
}
```

#### Lab Report Structure:
```typescript
{
  id: string;
  fileName: string;
  uploadedAt: Date;
  sizeBytes: number;
  category: string;
  notes?: string;
  url?: string;
}
```

---

## 3. API Architecture

### 3.1 API Endpoints

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| POST | `/api/auth/login` | User login | No | All |
| GET | `/api/users` | List users | Yes | Admin, Super Admin |
| GET | `/api/users?id=` | Get user by ID | Yes | Admin, Super Admin |
| POST | `/api/users` | Create user | Yes | Super Admin |
| PUT | `/api/users?id=` | Update user | Yes | Super Admin |
| DELETE | `/api/users` | Delete user | Yes | Super Admin |
| GET | `/api/content` | Get content | Yes | All (filtered) |

### 3.2 API Response Format

```typescript
// Success Response
{
  success: true,
  data: T | T[],
  message?: string
}

// Error Response
{
  success: false,
  error: string,
  code?: string
}
```

### 3.3 API Connection Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ Patient │ │ Doctor  │ │  Nurse  │ │ Clinic  │ │  Admin  │  │
│  │   App   │ │   App   │ │   App   │ │   App   │ │   App   │  │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘  │
└───────┼────────────┼───────────┼───────────┼───────────┼───────┘
        │            │           │           │           │
        ▼            ▼           ▼           ▼           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NEXT.JS API ROUTES                           │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                    /api/auth/login                       │    │
│  │  POST → Validate credentials → Create session → Return  │    │
│  └──────────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                    /api/users                            │    │
│  │  GET → Fetch users (filtered by role)                   │    │
│  │  POST → Create new user                                │    │
│  │  PUT → Update user                                     │    │
│  │  DELETE → Remove user                                  │    │
│  └──────────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                    /api/content                          │    │
│  │  GET → Fetch content (filtered by user role)            │    │
│  └──────────────────────────────────────────────────────────┘    │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DATABASE (PostgreSQL)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │  Users   │ │ Sessions │ │ Products │ │  Drips   │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Batches  │ │ Orders   │ │  Bookings│ │  Labs    │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. User Flows

### 4.1 Authentication Flow

```
┌──────────────┐
│  Login Page  │
│   /login     │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ Enter Email &       │
│ Password             │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ POST /api/auth/login │
└──────────┬───────────┘
           │
     ┌─────┴─────┐
     │  Success?  │
     └─────┬─────┘
    No     │      Yes
     │     │
     ▼     ▼
┌─────────┐  ┌────────────────────────┐
│ Show    │  │ Store token in        │
│ Error   │  │ localStorage          │
└─────────┘  └──────────┬─────────────┘
                        │
                        ▼
              ┌────────────────────────┐
              │ Dispatch auth change   │
              │ event                 │
              └──────────┬─────────────┘
                         │
                         ▼
              ┌────────────────────────┐
              │ Redirect by role:      │
              │ • admin → /admin       │
              │ • doctor → /doctor    │
              │ • nurse → /nurse      │
              │ • clinic → /clinic    │
              │ • patient → /patient  │
              └────────────────────────┘
```

### 4.2 Super Admin User Management Flow

```
┌──────────────────────┐
│  Admin Dashboard     │
│  /dashboard/admin    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Click "Manage Users" │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ /dashboard/admin/    │
│      manage          │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ GET /api/users      │
│ ?role=patient       │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Display User Table   │
│ [Add] [Edit] [Delete]│
└──────────┬───────────┘
           │
     ┌─────┴─────┐
     │ Action?   │
     └─────┬─────┘
           │
    ┌─────┼─────┬─────────┐
    │     │     │         │
    ▼     ▼     ▼         ▼
 [Add] [Edit] [Delete] [View]
    │     │     │         │
    │     │     │         │
    ▼     │     ▼         │
┌────────┐│  ┌────────┐   │
│Form    ││  │DELETE  │   │
│POST    ││  │/api/   │   │
│/api/   ││  │users   │   │
│users   ││  └────────┘   │
└────────┘│               │
    │     │               │
    ▼     ▼               ▼
┌──────────────────────────────┐
│ Success → Refresh table     │
│ Error → Show error message  │
└─────────────────────────────┘
```

### 4.3 Doctor Treatment Plan Flow

```
┌──────────────────────┐
│  Doctor Dashboard    │
│  /dashboard/doctor   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Click "Create Plan"  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Enter Patient Info   │
│ • Name, Age, Gender │
│ • Diagnosis         │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Configure Sessions   │
│ • Total weeks       │
│ • Sessions per week │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Add Drip Components  │
│ • Select drip type  │
│ • Set dose & route  │
│ • Add notes         │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Save Treatment Plan  │
│ (localStorage)       │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Share with Nurse?    │
│ ○ Yes  ○ No          │
└──────────┬───────────┘
           │
     ┌─────┴─────┐
     │   Yes      │
     └─────┬─────┘
           │
           ▼
┌──────────────────────┐
│ Send to Nurse        │
│ • Nurse receives     │
│   notification       │
│ • Can prepare drip   │
└──────────────────────┘
```

### 4.4 Nurse Infusion Flow

```
┌──────────────────────┐
│  Nurse Dashboard     │
│  /dashboard/nurse    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ View Today's Orders  │
│ GET infusion orders  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Select Order         │
│ View Treatment Plan  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Start Infusion       │
│ Checklist            │
├──────────────────────┤
│ □ Verify patient ID   │
│ □ Check allergies    │
│ □ Prepare equipment  │
│ □ Prepare drip       │
│ □ Start infusion     │
│ □ Monitor vitals     │
│ □ Complete session   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Mark Session         │
│ Complete             │
└──────────────────────┘
```

### 4.5 Patient Booking Flow

```
┌──────────────────────┐
│  Patient Dashboard   │
│  /dashboard/patient  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Complete Health Quiz │
│ (if not done)        │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Click "Book Session" │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Select Treatment     │
│ • Choose drip type  │
│ • Select date/time  │
│ • Choose location   │
│   (home/clinic)     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Confirm Booking      │
│ POST booking request │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ View Upcoming        │
│ Sessions             │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Receive Treatment    │
│ (Nurse visits/      │
│  clinic visit)       │
└──────────────────────┘
```

---

## 5. Data Flows

### 5.1 User Creation Data Flow (Admin → API → Database)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Admin    │────▶│   Client    │────▶│  Next.js    │────▶│ PostgreSQL  │
│  Dashboard │     │  (React)    │     │  API Route  │     │  Database   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
     │                   │                   │                    │
     │ 1. Fill form     │                   │                    │
     │ (name, email,    │                   │                    │
     │  role, etc.)     │                   │                    │
     │                  │                   │                    │
     │────────────────▶│                   │                    │
     │                  │                   │                    │
     │                  │ 2. POST /api/users                    │
     │                  │ {                │                    │
     │                  │   name,          │                    │
     │                  │   email,         │                    │
     │                  │   password,      │                    │
     │                  │   role           │                    │
     │                  │ }                │                    │
     │                  │                  │                    │
     │                  │─────────────────▶│                    │
     │                  │                  │                    │
     │                  │                  │ 3. Hash password   │
     │                  │                  │    (bcrypt)        │
     │                  │                  │                    │
     │                  │                  │ 4. INSERT user     │
     │                  │                  │───────────────────▶│
     │                  │                  │                    │
     │                  │                  │                    │ 5. Store in
     │                  │                  │                    │    users table
     │                  │                  │                    │
     │                  │                  │◀──────────────────│
     │                  │                  │ 6. Return created  │
     │                  │◀─────────────────│  user (without    │
     │                  │                  │  password)         │
     │                  │                  │                    │
     │◀─────────────────│                  │                    │
     │ 7. Show success │                  │                    │
     │    message       │                  │                    │
     │                  │                  │                    │
```

### 5.2 Treatment Plan Data Flow (Doctor → Nurse → Patient)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Doctor    │────▶│   Next.js   │────▶│   Nurse     │────▶│   Patient  │
│  Dashboard  │     │  API/Database│    │  Dashboard  │     │  Dashboard  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
     │                   │                   │                    │
     │ 1. Create plan    │                   │                    │
     │ (multi-week,      │                   │                    │
     │  drip configs)    │                   │                    │
     │                  │                   │                    │
     │─────────────────▶│                   │                    │
     │                  │ 2. Store plan     │                    │
     │                  │    in database    │                    │
     │                  │───────────────────│                    │
     │                  │                   │                    │
     │                  │ 3. Share plan     │                    │
     │                  │    (shared flag)  │                    │
     │                  │                   │                    │
     │                  │◀─────────────────│                    │
     │                  │                   │                    │
     │◀─────────────────│                   │                    │
     │ 4. Confirmed     │                   │                    │
     │                  │                   │                    │
     │                  │                   │ 5. View shared     │
     │                  │                   │    plans           │
     │                  │                   │                    │
     │                  │                   │───────────────────▶│
     │                  │                   │                    │
     │                  │                   │                    │ 6. See upcoming
     │                  │                   │                    │    session
     │                  │                   │                    │
     │                  │                   │                    │ 7. Receive
     │                  │                   │                    │    treatment
     │                  │                   │                    │
```

### 5.3 Inventory Data Flow (Admin → Products → Orders)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Admin    │────▶│  Inventory  │────▶│  Database   │────▶│   Clinic    │
│  Dashboard │     │    View     │     │             │     │  Dashboard  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
     │                   │                   │                    │
     │ 1. Add product   │                   │                    │
     │ 2. Add batch    │                   │                    │
     │ 3. Create drip  │                   │                    │
     │ 4. Check avail  │                   │                    │
     │ 5. Create order │                   │                    │
     │                  │                   │                    │
     │─────────────────▶│                   │                    │
     │                  │ 6. CRUD ops      │                    │
     │                  │─────────────────▶│                    │
     │                  │                   │ 7. Update tables:  │
     │                  │                   │  • products        │
     │                  │                   │  • batches         │
     │                  │                   │  • drips           │
     │                  │                   │  • orders          │
     │                  │                   │                    │
     │◀─────────────────│                   │                    │
     │ 8. View updated  │                   │                    │
     │    inventory     │                   │                    │
     │                  │                   │◀──────────────────│
     │                  │                   │ 9. Stock update    │
     │                  │                   │    notification    │
     │                  │                   │                    │
     │                  │                   │───────────────────▶│
     │                  │                   │                    │ 10. View order
     │                  │                   │                    │     status
     │                  │                   │                    │
```

---

## 6. Database Schema

### 6.1 Core Tables

```sql
-- Users table (all roles)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL, -- bcrypt hashed
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(50) NOT NULL CHECK (role IN ('superadmin', 'admin', 'doctor', 'nurse', 'clinic', 'patient')),
  permissions JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Products (inventory)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  hsn_code VARCHAR(50),
  category VARCHAR(50), -- DRUG, FLUID, CONSUMABLE, PREMED
  molecule VARCHAR(255),
  reorder_level INTEGER DEFAULT 0,
  is_multidose BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Batches (inventory lots)
CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  brand_name VARCHAR(255),
  manufacturer VARCHAR(255),
  batch_number VARCHAR(100),
  expiry_date DATE NOT NULL,
  content_value DECIMAL(10,2),
  content_unit VARCHAR(50),
  unit_form VARCHAR(100),
  qty_on_hand INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Drips (formulas)
CREATE TABLE drips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  infusion_notes TEXT,
  with_kit BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Drip ingredients
CREATE TABLE drip_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drip_id UUID REFERENCES drips(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  dose DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  role VARCHAR(50) NOT NULL, -- ACTIVE, FLUID, PREMED, ADDITIVE
  created_at TIMESTAMP DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordered_by UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'draft',
  amount DECIMAL(12,2) DEFAULT 0,
  scheduled_delivery DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Order items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  drip_id UUID REFERENCES drips(id),
  quantity INTEGER NOT NULL,
  with_kit BOOLEAN DEFAULT false,
  unit_price DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Treatment plans
CREATE TABLE treatment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES users(id),
  doctor_id UUID REFERENCES users(id),
  nurse_id UUID REFERENCES users(id),
  diagnosis TEXT,
  start_date DATE,
  total_weeks INTEGER,
  is_shared BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Health quizzes
CREATE TABLE health_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES users(id),
  responses JSONB NOT NULL,
  vitality_score INTEGER,
  recommendations JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Lab reports
CREATE TABLE lab_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES users(id),
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT,
  file_size INTEGER,
  category VARCHAR(100),
  notes TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW()
);
```

### 6.2 Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    Users    │──────▶│   Sessions  │       │   Products  │
│─────────────│       │─────────────│       │─────────────│
│ id (PK)     │       │ id (PK)    │       │ id (PK)     │
│ email       │       │ user_id (FK)│       │ name        │
│ name        │       │ token       │       │ hsn_code    │
│ role        │       │ expires_at  │       │ category    │
│ password    │       └─────────────┘       │ molecule    │
│ permissions │                               └──────┬──────┘
└──────┬──────┘                                      │
       │                                             │
       │         ┌─────────────┐                      │
       │         │   Batches   │◀─────────────────────┘
       │         │─────────────│
       │         │ id (PK)     │
       │         │ product_id  │ (FK)
       │         │ batch_no    │
       │         │ expiry_date│
       │         │ qty_on_hand│
       │         └─────────────┘
       │
       │         ┌─────────────┐       ┌─────────────────┐
       ├────────▶│ Treatment   │──────▶│ Treatment Plan  │
       │         │   Plans     │       │    Sessions     │
       │         │─────────────│       │─────────────────│
       │         │ id (PK)     │       │ drip_name       │
       │         │ patient_id  │       │ components      │
       │         │ doctor_id   │       │ session_notes   │
       │         │ nurse_id    │       └─────────────────┘
       │         │ diagnosis   │
       │         │ is_shared   │
       │         └─────────────┘
       │
       │         ┌─────────────┐       ┌─────────────────┐
       ├────────▶│Health Quizzes│      │  Lab Reports    │
       │         │─────────────│       │─────────────────│
       │         │ id (PK)     │       │ id (PK)        │
       │         │ patient_id  │       │ patient_id (FK)│
       │         │ responses   │       │ file_name      │
       │         │ vitality_   │       │ file_url       │
       │         │   score     │       │ category       │
       │         └─────────────┘       └─────────────────┘
       │
       │         ┌─────────────┐       ┌─────────────────┐
       ├────────▶│   Orders    │──────▶│  Order Items    │
       │         │─────────────│       │─────────────────│
       │         │ id (PK)     │       │ id (PK)        │
       │         │ ordered_by  │       │ order_id (FK)  │
       │         │ status      │       │ drip_id (FK)   │
       │         │ amount      │       │ quantity        │
       │         │ scheduled_  │       │ with_kit        │
       │         │   delivery  │       │ unit_price      │
       │         └─────────────┘       └─────────────────┘
       │
       │         ┌─────────────┐
       └────────▶│   Drips     │◀─────────────────────┐
                 │─────────────│                        │
                 │ id (PK)     │                        │
                 │ name        │                        │
                 │ description │       ┌─────────────────┴───┐
                 │ infusion_   │       │  Drip Ingredients  │
                 │   notes     │       │─────────────────────│
                 │ with_kit    │       │ id (PK)            │
                 │ is_active   │       │ drip_id (FK)       │
                 │ created_by  │       │ product_id (FK)    │
                 └─────────────┘       │ dose               │
                                       │ unit               │
                                       │ role               │
                                       └─────────────────────┘
```

---

## 7. Role Permissions Matrix

| Feature | Super Admin | Admin | Doctor | Nurse | Clinic | Patient |
|---------|:-----------:|:-----:|:------:|:-----:|:------:|:-------:|
| **Authentication** |
| Login | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Logout | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Users** |
| View all users | ✓ | ✓ | - | - | - | - |
| Create user | ✓ | - | - | - | - | - |
| Edit user | ✓ | - | - | - | - | - |
| Delete user | ✓ | - | - | - | - | - |
| **Inventory** |
| View products | ✓ | ✓ | - | - | - | - |
| Manage products | ✓ | - | - | - | - | - |
| View batches | ✓ | ✓ | - | - | - | - |
| Manage batches | ✓ | - | - | - | - | - |
| Build drips | ✓ | - | - | - | - | - |
| Check availability | ✓ | ✓ | - | - | - | - |
| **Orders** |
| View orders | ✓ | ✓ | ✓ | ✓ | ✓ | - |
| Create order | ✓ | ✓ | - | - | ✓ | - |
| Update order | ✓ | ✓ | - | - | - | - |
| **Treatment** |
| View treatment plans | ✓ | ✓ | ✓ | ✓ | - | ✓ |
| Create treatment plan | ✓ | - | ✓ | - | - | - |
| Share with nurse | ✓ | - | ✓ | - | - | - |
| Prepare infusion | ✓ | - | - | ✓ | - | - |
| Complete session | ✓ | - | - | ✓ | - | - |
| **Health** |
| Take health quiz | - | - | - | - | - | ✓ |
| Review quizzes | ✓ | ✓ | ✓ | - | - | - |
| Upload lab reports | - | - | - | - | - | ✓ |
| View lab reports | ✓ | ✓ | ✓ | - | - | ✓ |
| **Bookings** |
| Book session | - | - | - | - | - | ✓ |
| View bookings | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manage bookings | ✓ | ✓ | - | - | - | - |
| **Clinic** |
| View clinic profile | ✓ | ✓ | - | - | ✓ | - |
| Update clinic info | ✓ | - | - | - | ✓ | - |
| **AI** |
| Configure AI models | ✓ | - | - | - | - | - |
| View AI settings | ✓ | - | - | - | - | - |
| **Approvals** |
| View approvals | ✓ | ✓ | ✓ | - | - | - |
| Approve/Reject | ✓ | ✓ | ✓ | - | - | - |

---

*Document Version: 1.0*
*Last Updated: August 2026*
