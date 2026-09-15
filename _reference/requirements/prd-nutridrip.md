# Nutridrip - Product Requirements Document (PRD)

**Version:** 1.0
**Last Updated:** August 2026
**Status:** Active Development

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Product Vision](#2-product-vision)
3. [Target Users](#3-target-users)
4. [User Personas](#4-user-personas)
5. [Core Features](#5-core-features)
6. [Feature Specifications](#6-feature-specifications)
7. [User Flows](#7-user-flows)
8. [Technical Requirements](#8-technical-requirements)
9. [API Architecture](#9-api-architecture)
10. [Database Schema](#10-database-schema)
11. [Security Requirements](#11-security-requirements)
12. [Performance Requirements](#12-performance-requirements)
13. [Design System](#13-design-system)
14. [Roadmap](#14-roadmap)
15. [Success Metrics](#15-success-metrics)

---

## 1. Executive Summary

### 1.1 Product Overview

Nutridrip is a comprehensive IV therapy management platform that connects patients, doctors, nurses, clinics, and administrators in a unified ecosystem for managing intravenous drip treatments.

### 1.2 Problem Statement

| Problem | Impact | Current State |
|---------|--------|---------------|
| Fragmented communication | Delayed treatments, errors | Phone/WhatsApp based |
| Manual inventory | Stockouts, wastage | Spreadsheets |
| No standardized protocols | Inconsistent care | Varies by clinic |
| Poor progress tracking | No data-driven decisions | Paper records |
| No real-time availability | Wasted time | Manual calculation |

### 1.3 Solution

A unified platform providing:
- End-to-end treatment workflow management
- Real-time inventory with FEFO tracking
- AI-powered treatment recommendations
- Multi-stakeholder dashboards
- Seamless booking and scheduling

### 1.4 Key Benefits

| For | Benefit |
|-----|---------|
| Patients | Easier booking, health tracking, lab uploads |
| Doctors | Create plans, review quizzes, approve treatments |
| Nurses | Infusion checklist, order management |
| Clinics | Dashboard, orders, revenue tracking |
| Admins | Full control, analytics, approvals |

---

## 2. Product Vision

### 2.1 Mission

"To make personalized IV therapy accessible, safe, and efficient for everyone."

### 2.2 Core Values

| Value | Description | Example |
|-------|-------------|---------|
| Patient-Centric | Safety first | Real-time availability checks |
| Clinical Excellence | Evidence-based | AI recommendations |
| Transparency | Clear pricing | Full order visibility |
| Efficiency | Save time | One-click drip building |

### 2.3 Success Definition

> Nutridrip succeeds when a patient can book a drip in under 2 minutes, doctors can create treatment plans in under 5 minutes, and nurses can prepare infusions with zero errors.

---

## 3. Target Users

### 3.1 Primary Users

| User Type | Count (Est.) | Primary Use |
|-----------|-------------|-------------|
| Patients | 10,000+ | Book treatments, upload labs |
| Doctors | 50-100 | Create treatment plans |
| Nurses | 100-200 | Prepare & execute treatments |
| Clinics | 20-50 | Manage operations |

### 3.2 Secondary Users

| User Type | Role |
|-----------|------|
| Super Admin | Platform management |
| Admin | Operations & approvals |
| Support Staff | Customer service |

---

## 4. User Personas

### 4.1 Priya, 32 - Busy Professional

**Profile:**
- Works 60+ hours/week
- Values convenience
- Health-conscious but time-poor

**Goals:**
- Book drip therapy quickly
- Track health improvements
- Minimal disruption to schedule

**Pain Points:**
- Can't find time for clinic visits
- Confused about which drip is right

**Solution:**
- Home booking with nurse visit
- AI-powered drip recommendations
- Quick 45-minute sessions

---

### 4.2 Dr. Amit, 45 - Integrative Medicine Doctor

**Profile:**
- Runs own clinic
- Treats 20+ patients/day
- Evidence-based approach

**Goals:**
- Create standardized treatment plans
- Monitor patient progress
- Reduce manual paperwork

**Pain Points:**
- Spent hours on treatment documentation
- No visibility into nurse preparation
- Hard to track outcomes

**Solution:**
- Treatment plan builder
- Real-time nurse progress
- Analytics dashboard

---

### 4.3 Sunita, 28 - Registered Nurse

**Profile:**
- Works at partner clinic
- Administers 10+ drips/day
- Detail-oriented

**Goals:**
- Prepare drips without errors
- Follow checklist precisely
- Document each step

**Pain Points:**
- Manual inventory checks
- Confusion about drip components
- No clear instructions

**Solution:**
- Infusion checklist
- Clear drip instructions
- Inventory integration

---

### 4.4 Raj, 55 - Clinic Owner

**Profile:**
- Owns 3 IV therapy clinics
- Business-focused
- Tracks revenue closely

**Goals:**
- Increase clinic revenue
- Reduce costs
- Manage staff efficiently

**Pain Points:**
- No centralized dashboard
- Manual inventory ordering
- Staff scheduling conflicts

**Solution:**
- Clinic dashboard
- Order management
- Revenue analytics

---

## 5. Core Features

### 5.1 Feature Overview

| Feature | Description | Priority |
|---------|-------------|----------|
| User Authentication | Login, session, role-based access | P0 |
| Dashboard | Role-specific home screens | P0 |
| Health Quiz | Patient vitality assessment | P0 |
| Treatment Plans | Multi-week drip plans | P0 |
| Drip Builder | Create custom IV drips | P0 |
| Inventory Management | Products, batches, FEFO | P0 |
| Availability Calculator | Check drip feasibility | P0 |
| Order Management | Create, track orders | P0 |
| Booking System | Schedule sessions | P1 |
| Lab Reports | Upload & view reports | P1 |
| AI Studio | Configure AI models | P1 |
| Alerts | Expiry, low stock warnings | P1 |
| Clinic Management | Partner dashboard | P2 |
| Analytics | Platform insights | P2 |

### 5.2 Priority Definitions

| Priority | Definition | SLA |
|----------|------------|-----|
| P0 | Must have for launch | 2 weeks |
| P1 | Important, launch soon | 1 month |
| P2 | Nice to have | 3+ months |

---

## 6. Feature Specifications

### 6.1 Authentication System

#### Description
Secure login with role-based access control.

#### User Roles
```
- superadmin: Full platform access
- admin: Operations & approvals
- doctor: Treatment planning
- nurse: Treatment execution
- clinic: Partner operations
- patient: End user
```

#### Flows

**Login Flow:**
```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Login   │────▶│  Validate│────▶│  Redirect│
│  Page    │     │  Credentials  │  to Dashboard
└──────────┘     └──────────┘     └──────────┘
                      │
                 ┌────┴────┐
                 │ Success? │
                 └────┬────┘
                No    │    Yes
                 │     │
                 ▼     ▼
            ┌───────┐ ┌──────────┐
            │ Show  │ │ Create   │
            │ Error │ │ Session  │
            └───────┘ └──────────┘
```

**Session Management:**
- JWT-based authentication
- 24-hour token expiry
- Refresh token support
- Secure logout

#### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Authenticate user |
| POST | /api/auth/logout | End session |
| GET | /api/auth/session | Get current session |

#### Security
- Password hashing (bcrypt)
- Rate limiting on login
- Account lockout after 5 failed attempts
- Session invalidation on logout

---

### 6.2 Super Admin Dashboard

#### Description
Central hub for platform management.

#### Features
1. **Stats Overview**
   - Total patients
   - Active doctors
   - Partner clinics
   - Pending approvals
   - Revenue

2. **Quick Actions**
   - Manage Users
   - View Inventory
   - AI Studio
   - View Approvals

3. **User Management**
   - CRUD all users
   - Role assignment
   - Status toggle

#### Screens
```
┌───���────────────────────────────────────────┐
│  Nutridrip Admin                     [User]│
├────────────────────────────────────────────┤
│                                            │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│  │ 150  │ │  25  │ │  12  │ │  8   │    │
│  │Pats  │ │Docs  │ │Clinics│ │Apprv │    │
│  └──────┘ └──────┘ └──────┘ └──────┘    │
│                                            │
│  Revenue: ₹12,45,000 this month            │
│                                            │
│  [Manage Users] [Inventory] [AI Studio]    │
│                                            │
│  Recent Approvals                          │
│  ┌────────────────────────────────────┐   │
│  │ Dr. Smith - Plan approval - PENDING │   │
│  └────────────────────────────────────┘   │
└────────────────────────────────────────────┘
```

---

### 6.3 Doctor Dashboard

#### Description
Treatment planning hub for doctors.

#### Features
1. **Health Quizzes**
   - Review patient responses
   - Approve/reject quizzes
   - Add recommendations

2. **Treatment Plans**
   - Create multi-week plans
   - Set drip components
   - Configure doses & routes
   - Share with nurses

3. **Sessions**
   - View upcoming sessions
   - Track patient progress
   - Session history

4. **Approvals**
   - Review upgrade requests
   - Approve protocol changes

#### Treatment Plan Structure
```typescript
interface TreatmentPlan {
  id: string;
  patientId: string;
  doctorId: string;
  diagnosis: string;
  startDate: Date;
  totalWeeks: number;
  weeks: TreatmentWeek[];
  sharedWithNurse: boolean;
  status: 'draft' | 'active' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

interface TreatmentWeek {
  weekNum: number;
  sessions: TreatmentSession[];
}

interface TreatmentSession {
  id: string;
  date: string;
  dripName: string;
  components: DripComponent[];
  sessionNotes: string;
}

interface DripComponent {
  id: string;
  name: string;
  dose: string;
  unit: string;
  route: 'IV Drip in NS' | 'IV Drip in RL' | 'IV Push/Bolus' | 'IM Injection';
  carrier: string;
}
```

---

### 6.4 Nurse Dashboard

#### Description
Infusion execution center for nurses.

#### Features
1. **Infusion Orders**
   - View assigned treatments
   - Filter by status
   - Patient details

2. **Infusion Checklist**
   - Step-by-step preparation
   - Component verification
   - Timing controls
   - Documentation

3. **Completed Sessions**
   - Session history
   - Patient feedback

#### Infusion Checklist
```
┌────────────────────────────────────────────┐
│  Infusion Checklist                    [ID] │
├────────────────────────────────────────────┤
│                                            │
│  Patient: John Doe                         │
│  Drip: Energy Boost                        │
│  Scheduled: 10:00 AM                       │
│                                            │
│  ☐ 1. Verify patient identity             │
│  ☐ 2. Check doctor's prescription         │
│  ☐ 3. Gather components                   │
│      • Vitamin C 500mg                     │
│      • B-Complex 1ml                       │
│      • Glutathione 600mg                   │
│      • NS 100ml                           │
│  ☐ 4. Verify component expiry            │
│  ☐ 5. Prepare IV set                     │
│  ☐ 6. Start infusion @ 20 drops/min       │
│  ☐ 7. Monitor patient                    │
│  ☐ 8. Complete & document                │
│                                            │
│  [Start Timer]  [Complete Session]         │
└────────────────────────────────────────────┘
```

---

### 6.5 Patient Dashboard

#### Description
Personal health hub for patients.

#### Features
1. **Health Quiz**
   - Vitality assessment
   - Symptom checker
   - Goals setting

2. **Book Session**
   - Select drip
   - Choose location (home/clinic/office)
   - Schedule date/time
   - Assign nurse

3. **Upcoming Sessions**
   - Next 5 sessions
   - Session details
   - Cancel/reschedule

4. **Lab Reports**
   - Upload documents
   - View history
   - Share with doctor

5. **Profile**
   - Personal info
   - Health history
   - Allergies
   - Emergency contact

#### Health Quiz Questions
```
1. Energy Levels
   - How would you rate your energy daily?
   [Poor] [Fair] [Good] [Excellent]

2. Sleep Quality
   - Hours of sleep per night?
   [<5] [5-6] [6-7] [7-8] [8+]

3. Stress Levels
   - Current stress management?
   [Poor] [Fair] [Good] [Excellent]

4. Hydration
   - Daily water intake?
   [<1L] [1-2L] [2-3L] [3L+]

5. Exercise
   - Weekly exercise frequency?
   [None] [1-2x] [3-4x] [5+]
```

---

### 6.6 Inventory Management

#### Description
Real-time inventory tracking with FEFO methodology.

#### Tabs

**1. Inventory View**
- Products list
- Batch lots
- Stock levels
- Expiry dates

**2. Drip Builder**
- Create drips
- Add ingredients
- Set doses
- Activate/deactivate

**3. Availability Calculator**
- Select drip
- Enter quantity
- Check feasibility
- View bottleneck

**4. Orders View**
- Create orders
- Track status
- Filter by state

**5. Alerts View**
- Expiry alerts
- Low stock warnings

#### Data Models

```typescript
// Product
interface Product {
  id: string;
  name: string;
  category: 'DRUG' | 'FLUID' | 'CONSUMABLE' | 'PREMED';
  hsnCode: string;
  manufacturer: string;
  unit: string;
  stockQuantity: number;
  minStockLevel: number;
  price: number;
  createdAt: Date;
}

// Batch
interface Batch {
  id: string;
  productId: string;
  batchNumber: string;
  expiryDate: Date;
  quantity: number;
  mrp: number;
  createdAt: Date;
}

// Drip
interface Drip {
  id: string;
  name: string;
  description: string;
  withKit: boolean;
  infusionNotes: string;
  ingredients: DripIngredient[];
  isActive: boolean;
  createdAt: Date;
}

// Order
interface Order {
  id: string;
  patientId: string;
  status: 'DRAFT' | 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  items: OrderItem[];
  totalAmount: number;
  createdAt: Date;
}
```

---

### 6.7 AI Studio

#### Description
Configure AI models for treatment recommendations.

#### Features
- Model selection
- Parameter tuning
- Prompt templates
- Training data
- Performance metrics

#### Configuration
```typescript
interface AIConfig {
  model: 'gpt-4' | 'gpt-3.5' | 'claude';
  temperature: number; // 0-1
  maxTokens: number;
  systemPrompt: string;
  userPromptTemplate: string;
}
```

---

## 7. User Flows

### 7.1 Complete Treatment Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Patient │────▶│ Doctor  │──���─▶│ Nurse   │────▶│ Patient │
│ Quiz    │     │ Plan    │     │ Prepare │     │ Treated │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
     │               │               │
     ▼               ▼               ▼
┌───────────────────���─────────────────────────┐
│              INVENTORY CHECK                 │
│         (Real-time availability)            │
└─────────────────────────────────────────────┘
```

### 7.2 Booking Flow

```
┌──────────┐
│  Patient │
│  Login   │
└────┬─────┘
     │
     ▼
┌──────────┐
│ Health   │
│ Quiz     │
└────┬─────┘
     │
     ▼
┌──────────┐
│ Book     │──────┐
│ Session  │      │
└────┬─────┘      │
     │            │
     ▼            ▼
┌──────────┐ ┌──────────┐
│ Select   │ │ Assign   │
│ Drip     │ │ Nurse    │
└────┬─────┘ └────┬─────┘
     │            │
     ▼            ▼
┌──────────┐ ┌──────────┐
│ Schedule │ │ Confirm  │
│ Date     │ │ Booking  │
└────┬─────┘ └────┬─────┘
     │            │
     └─────┬──────┘
           │
           ▼
    ┌──────────┐
    │ Treatment│
    │ Day      │
    └────┬─────┘
         │
         ▼
    ┌──────────┐
    │ Nurse    │
    │ Checklist│
    └────┬─────┘
         │
         ▼
    ┌──────────┐
    │ Complete │
    │ Session  │
    └──────────┘
```

---

## 8. Technical Requirements

### 8.1 Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, TypeScript |
| Backend | Node.js, Next.js API Routes |
| Database | PostgreSQL (Supabase) |
| ORM | Prisma |
| Auth | JWT, bcrypt |
| Styling | CSS Modules |
| Deployment | Vercel |

### 8.2 System Architecture

```
┌─────────────────────────────────────────────────┐
│                   FRONTEND                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ Admin   │ │ Doctor  │ │ Patient │          │
│  │ Dashboard│ │ Portal  │ │ App    │          │
│  └────┬────┘ └────┬────┘ └────┬────┘          │
│       │            │            │                │
│       └────────────┼────────────┘                │
│                    │                             │
│              ┌─────▼─────┐                       │
│              │  Next.js  │                       │
│              │   App     │                       │
│              └─────┬─────┘                       │
└────────────────────┼──────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│                   BACKEND                        │
│              ┌─────────────┐                    │
│              │ API Routes  │                    │
│              │ /api/auth   │                    │
│              │ /api/users  │                    │
│              │ /api/...    │                    │
│              └───��──┬──────┘                    │
│                     │                            │
│              ┌──────▼──────┐                    │
│              │  Prisma ORM │                    │
│              └──────┬──────┘                    │
└─────────────────────┼────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│                 DATABASE                         │
│              ┌─────────────┐                    │
│              │ PostgreSQL  │                    │
│              │ (Supabase) │                    │
│              └─────────────┘                    │
└─────────────────────────────────────────────────┘
```

### 8.3 Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/nutridrip

# Auth
JWT_SECRET=your-secret-key
SESSION_EXPIRY=86400

# External Services
OPENAI_API_KEY=sk-xxx
```

---

## 9. API Architecture

### 9.1 API Endpoints

#### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | User login |
| POST | /api/auth/logout | User logout |
| GET | /api/auth/session | Get current session |

#### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/users | List all users |
| GET | /api/users?role=doctor | Filter by role |
| GET | /api/users/:id | Get user by ID |
| POST | /api/users | Create user |
| PUT | /api/users/:id | Update user |
| DELETE | /api/users/:id | Delete user |

#### Content
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/content | Get content |
| POST | /api/content | Create content |

### 9.2 Response Format

```typescript
// Success
{
  success: true,
  data: { ... }
}

// Error
{
  success: false,
  error: "Error message"
}
```

### 9.3 Authentication Header

```
Authorization: Bearer <jwt_token>
```

---

## 10. Database Schema

### 10.1 Core Tables

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(50) NOT NULL,
  permissions JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  hsn_code VARCHAR(50),
  manufacturer VARCHAR(255),
  unit VARCHAR(50) NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  min_stock_level INTEGER DEFAULT 0,
  price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Batches
CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  batch_number VARCHAR(100) NOT NULL,
  expiry_date DATE NOT NULL,
  quantity INTEGER NOT NULL,
  mrp DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Drips
CREATE TABLE drips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  with_kit BOOLEAN DEFAULT false,
  infusion_notes TEXT,
  ingredients JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'DRAFT',
  items JSONB NOT NULL,
  total_amount DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 11. Security Requirements

### 11.1 Authentication

- [ ] bcrypt password hashing (min 10 rounds)
- [ ] JWT tokens with 24-hour expiry
- [ ] Secure token storage
- [ ] Session invalidation on logout

### 11.2 Authorization

- [ ] Role-based access control (RBAC)
- [ ] Permission checks on all routes
- [ ] Least privilege principle

### 11.3 Data Protection

- [ ] Input validation
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] HTTPS only
- [ ] Secure headers

### 11.4 Compliance

- [ ] GDPR compliant data handling
- [ ] Medical data protection
- [ ] Audit logging

---

## 12. Performance Requirements

### 12.1 Speed

| Metric | Target |
|--------|--------|
| Page Load | < 2s |
| API Response | < 500ms |
| Database Query | < 200ms |

### 12.2 Availability

| Metric | Target |
|--------|--------|
| Uptime | 99.9% |
| Error Rate | < 0.1% |

### 12.3 Scalability

- Support 10,000+ patients
- Handle 100+ concurrent users
- Process 1000+ orders/month

---

## 13. Design System

### 13.1 Brand Colors

```css
:root {
  /* Primary */
  --teal: #0C8074;
  --teal-light: #14A89C;
  --teal-dark: #086560;

  /* Secondary */
  --sky: #5BB8F5;
  --sky-light: #8ECAFA;

  /* Neutral */
  --text: #111827;
  --text-2: #374151;
  --text-3: #6B7280;
  --border: #E5E7EB;
  --bg: #F9FAFB;

  /* Status */
  --success: #1A9E6A;
  --warning: #D97706;
  --error: #DC2626;
}
```

### 13.2 Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| H1 | Space Grotesk | 36px | 700 |
| H2 | Space Grotesk | 28px | 600 |
| H3 | Space Grotesk | 20px | 600 |
| Body | Inter | 14px | 400 |
| Small | Inter | 12px | 400 |

### 13.3 Spacing

```css
:root {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
}
```

### 13.4 Components

| Component | States |
|-----------|--------|
| Buttons | default, hover, active, disabled |
| Inputs | default, focus, error, disabled |
| Cards | default, hover |
| Pills | success, warning, error, info |
| Tables | default, hover rows |

---

## 14. Roadmap

### Phase 1 - MVP (Current)
- [x] Authentication
- [x] Dashboards (Admin, Doctor, Nurse, Clinic, Patient)
- [x] Inventory Management
- [x] Drip Builder
- [x] Availability Calculator
- [ ] Real API integration
- [ ] Booking system

### Phase 2 - Launch
- [ ] Lab report upload
- [ ] Payment integration
- [ ] Notification system
- [ ] Analytics dashboard

### Phase 3 - Scale
- [ ] Mobile app
- [ ] Telemedicine integration
- [ ] Advanced AI recommendations
- [ ] Multi-location support

### Phase 4 - Enterprise
- [ ] White-label options
- [ ] API for third-party integration
- [ ] Advanced reporting
- [ ] Custom branding

---

## 15. Success Metrics

### 15.1 Product Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| DAU | 500+ | Daily logins |
| MAU | 2000+ | Monthly logins |
| Session Duration | 5+ min | Avg time on app |
| Feature Adoption | 60%+ | Quiz completion |

### 15.2 Business Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Bookings | 500/month | Sessions booked |
| Revenue | ₹10L/month | GMV |
| NPS | 50+ | User satisfaction |
| Retention | 70%+ | 3-month retention |

### 15.3 Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Uptime | 99.9% | Uptime monitor |
| Load Time | < 2s | Lighthouse |
| Error Rate | < 0.1% | Error tracking |
| API Latency | < 500ms | APM |

---

## Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| FEFO | First Expiry, First Out |
| IV | Intravenous |
| Drip | IV therapy treatment |
| Kit | Additional items (IV set, cannula) |
| Vitality | Patient health score |

### B. Acronyms

| Acronym | Full Form |
|---------|-----------|
| RBAC | Role-Based Access Control |
| JWT | JSON Web Token |
| ORM | Object-Relational Mapping |
| CRUD | Create, Read, Update, Delete |
| NPS | Net Promoter Score |
| DAU | Daily Active Users |
| MAU | Monthly Active Users |

### C. Contact

| Role | Email |
|------|-------|
| Product | product@nutridrip.com |
| Support | support@nutridrip.com |
| Technical | tech@nutridrip.com |

---

*Document Version: 1.0*
*Last Updated: August 2026*
*Next Review: September 2026*
