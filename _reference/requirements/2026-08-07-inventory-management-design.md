# Nutridrip Inventory Management Module — Design Spec

**Date:** 2026-08-07
**Status:** Draft
**Author:** Claude

---

## Overview

Integrate the Nutridrip inventory backend into the existing admin dashboard, adding:
1. **Inventory Module** — Product masters with multi-batch lot tracking
2. **Drip Builder** — Recipe creation with ingredients + session kits
3. **Availability Engine** — Real-time FEFO-based drip preparation calculations
4. **Order & Dispatch** — Create orders, reserve stock, consume on dispatch
5. **Alerts Dashboard** — Expiry, low-stock, and reorder notifications

---

## Architecture

### Integration Approach

Copy the existing `nutridrip-inventory-backend` into `src/apps/inventory-api/` within this Next.js project. The API runs on port 4000, Next.js on 3000. Use Next.js API routes as a thin proxy or direct fetch from the admin UI to the inventory API.

```
src/
├── apps/
│   └── inventory-api/       # Express + Prisma backend
│       ├── prisma/
│       ├── src/
│       │   ├── routes/      # API endpoints
│       │   ├── lib/         # FEFO engine + availability logic
│       │   └── middleware/  # Auth
│       └── package.json
├── components/
│   └── dashboard/
│       └── inventory/      # New inventory UI components
│           ├── InventoryList.tsx
│           ├── ProductMasterForm.tsx
│           ├── BatchLotForm.tsx
│           ├── DripBuilder.tsx
│           ├── AvailabilityChecker.tsx
│           ├── OrderCreate.tsx
│           ├── AlertsDashboard.tsx
│           └── SessionKitManager.tsx
└── app/
    └── dashboard/
        └── inventory/      # New routes
            ├── page.tsx
            ├── drips/
            ├── orders/
            └── alerts/
```

---

## Data Model

### Entities (from Prisma schema)

| Entity | Purpose |
|--------|---------|
| `ProductMaster` | Drug identity (name, HSN, molecule, category, canonical unit, reorder level, multidose flag) |
| `BatchLot` | Received batch (brand, batch no., expiry, content value/unit, qty on hand, MRP, cost) |
| `Drip` | Named recipe (name, description, infusion notes) |
| `DripIngredient` | Recipe line item (master ref, dose, unit, role: ACTIVE/FLUID/PREMED/ADDITIVE) |
| `SessionKit` | Consumables bundle (IV set, cannula, swabs, etc.) |
| `KitItem` | Kit line item (master ref, qty) |
| `Order` | Preparation request (patient ref, status, lines) |
| `OrderLine` | Drip × quantity in an order |
| `Allocation` | Soft reservation (order → batch lot) |
| `Consumption` | Immutable dispatch ledger (batch → order, wastage) |
| `StockTxn` | Full audit trail |

### Key Enums

```typescript
Category: 'DRUG' | 'FLUID' | 'CONSUMABLE' | 'PREMED'
IngredientRole: 'ACTIVE' | 'FLUID' | 'PREMED' | 'ADDITIVE'
OrderStatus: 'DRAFT' | 'CONFIRMED' | 'DISPATCHED' | 'CANCELLED'
TxnType: 'RECEIPT' | 'RESERVE' | 'RELEASE' | 'CONSUME' | 'ADJUST'
```

---

## Module 1: Inventory Module

### Routes

- `GET /inventory/masters` — List all products with stock summary
- `POST /inventory/masters` — Create product master
- `GET /inventory/masters/:id` — Product detail + all batch lots
- `POST /inventory/masters/:id/lots` — Receive new batch
- `POST /inventory/lots/:id/adjust` — Adjust stock (± with reason)

### UI Components

#### InventoryList.tsx
- Filterable table: category, expiry status, stock level
- Columns: Drug, Brand(s), Total Stock, Expiry Status, Actions
- Quick actions: View batches, add batch, edit
- Status badges: Expired (red), Expiring Soon (orange), Low Stock (yellow), Healthy (green)

#### ProductMasterForm.tsx
Fields:
- Drug Name (required)
- Molecule (optional, for grouping)
- HSN Code (required, unique)
- GST Rate (%)
- Category (dropdown)
- Canonical Unit (mg/mcg/ml/IU/unit)
- Reorder Level (number)
- Storage Condition (text)
- Multidose Toggle (default: false)
- Notes (optional)

#### BatchLotForm.tsx
Fields:
- Brand Name (required)
- Manufacturer (optional)
- Batch No. (required, unique per master)
- Expiry Date (date picker, required)
- Content Value (number, required)
- Content Unit (dropdown)
- Pack Volume ML (optional)
- Unit Form (Vial/Ampoule/Bottle/Bag/Piece/Sachet)
- Qty Received (number, required)
- Cost/Unit (optional)
- MRP (optional)

### Stock Calculation

```
totalOnHand(master) = SUM(lots.qtyOnHand) where expiry > today
totalAvailable(master) = totalOnHand - SUM(lots.qtyReserved)
```

---

## Module 2: Drip Builder

### Routes

- `GET /drips` — List all drips
- `POST /drips` — Create drip (returns unit-slip warnings)
- `GET /drips/:id` — Drip detail with ingredients
- `POST /drips/:id/ingredients` — Add ingredient
- `DELETE /drips/:id/ingredients/:ingId` — Remove ingredient
- `GET /kits` — List session kits
- `POST /kits` — Create kit
- `GET /kits/:id` — Kit detail

### UI Components

#### DripBuilder.tsx
**Step 1: Basic Info**
- Name (required, unique)
- Description (optional)
- Infusion Notes (optional)

**Step 2: Ingredients**
Dynamic list with:
| Drug | Dose | Unit | Role | Notes |
|------|------|------|------|-------|

- Drug: Autocomplete from ProductMaster
- Dose: Number input
- Unit: Dropdown (mg, mcg, ml, IU)
- Role: ACTIVE / FLUID / PREMED / ADDITIVE
- Notes: Optional text
- [+ Add Ingredient] button
- Unit-slip warning shown inline if canonical unit mismatch

**Step 3: Session Kit**
- Radio: "Include Surgical Kit" / "Without Kit"
- If included: Select kit from dropdown (or create new)
- Kit preview: List of consumables

**Save**: Validates recipe, saves drip

#### SessionKitManager.tsx
Create/edit session kits:
- Kit Name
- Items table: Product | Qty
- [+ Add Item]
- Set as Default toggle

---

## Module 3: Availability Engine

### Route

- `POST /availability/check` — Calculate availability for drip(s)

### Request Body

```json
{
  "items": [
    { "dripId": "abc123", "quantity": 5 }
  ],
  "includeKits": true
}
```

### Response

```json
{
  "results": [
    {
      "dripId": "abc123",
      "dripName": "Immunity Boost",
      "requested": 5,
      "pooledAvailability": 8,
      "wholeVialAvailability": 6,
      "canFulfill": true,
      "bottleneck": {
        "ingredient": "Vitamin C",
        "availableUnits": 6,
        "requiredPerDrip": 3
      },
      "ingredients": [
        {
          "masterId": "...",
          "drugName": "Vitamin C",
          "pooledUnits": 12,
          "wholeVialUnits": 6,
          "wastage": 6,
          "expirySoon": false,
          "batches": [
            { "batchNo": "B001", "expiry": "2026-12-01", "units": 4 },
            { "batchNo": "B002", "expiry": "2026-10-15", "units": 2 }
          ]
        }
      ]
    }
  ],
  "warnings": ["Vitamin C: batch B002 expires in 15 days"]
}
```

### Algorithm

1. For each drip ingredient, fetch all in-stock batches (FEFO sorted by expiry)
2. **Pooled calculation**: `floor(sum(qtyOnHand - qtyReserved) / dosePerDrip)`
3. **Whole-vial simulation**:
   - For each requested drip, allocate from earliest-expiring batch
   - If single-use: waste remainder, move to next batch
   - If multidose: carry remainder to next drip
   - Count total drips before any ingredient runs out
4. **Wastage**: `wholeVial - pooled` (per ingredient)
5. **Bottleneck**: Ingredient with lowest `wholeVialAvailability`

### UI Component

#### AvailabilityChecker.tsx
- Select drip(s) from dropdown
- Quantity input per drip
- [+ Add Drip] button
- [Check Availability] button
- Results card with:
  - Pooled vs Realistic numbers
  - Wastage breakdown
  - Bottleneck highlight
  - Batch allocation preview
  - Expiry warnings

---

## Module 4: Order & Dispatch

### Routes

- `POST /orders` — Create draft order
- `GET /orders` — List orders (filterable by status)
- `GET /orders/:id` — Order detail + allocations + consumption ledger
- `POST /orders/:id/confirm` — Soft-reserve stock FEFO
- `POST /orders/:id/dispatch` — Consume stock, write ledger
- `POST /orders/:id/cancel` — Release reservations

### UI Components

#### OrderCreate.tsx
**Form:**
- Patient Reference (optional, per DPDP)
- Patient Name (optional)
- Include Surgical Kits (checkbox, default: true)

**Order Lines:**
| Drip | Quantity | Price |
|------|----------|-------|

- [+ Add Drip] → Select drip + qty
- Remove line button

**Actions:**
- [Save Draft] — Creates order in DRAFT status
- [Check Availability] — Shows feasibility before confirming
- [Confirm Order] — Creates in CONFIRMED status, reserves stock

#### OrderDetail.tsx
**Status Banner:**
- DRAFT (gray) → CONFIRMED (blue) → DISPATCHED (green)
- Cancel button (if DRAFT or CONFIRMED)
- Dispatch button (if CONFIRMED)

**Order Lines Table:**
| Drip | Qty | Status |

**Allocations Table** (shown after confirm):
| Drug | Batch | Units Reserved | Expiry |

**Consumption Ledger** (shown after dispatch):
| Drug | Batch | Units Consumed | Active Used | Wasted |

---

## Module 5: Alerts Dashboard

### Route

- `GET /alerts?days=30` — Get alerts for expiring + low stock

### Alert Types

| Type | Condition | Severity |
|------|-----------|----------|
| EXPIRED | `expiry < today` | CRITICAL |
| EXPIRING_SOON | `expiry <= today + days` | WARNING |
| LOW_STOCK | `totalAvailable <= reorderLevel` | INFO |

### UI Component

#### AlertsDashboard.tsx
**Summary Cards:**
- 🔴 Expired: Count
- 🟠 Expiring Soon: Count
- 🟡 Low Stock: Count

**Tabs:**
1. **Expired Stock** — Table with batch details, [Dispose] action
2. **Expiring Soon** — Table sorted by expiry date, days remaining
3. **Low Stock** — Table with current qty vs reorder level, [Reorder] link

**Batch Detail Modal:**
- Drug name, brand, batch no.
- Current qty, expiry date
- Action: Adjust / Dispose / Use First

---

## Authentication & Roles

| Role | Permissions |
|------|-------------|
| ADMIN | Full access |
| PHARMACIST | Inventory, drips, kits, dispatch |
| FRONT_DESK | Create orders, confirm, check availability |

Admin dashboard users authenticate with existing session. New endpoints proxy to inventory API with admin role header.

---

## Implementation Order

1. **Copy & Setup Backend** — Copy inventory backend, set up in `src/apps/inventory-api/`
2. **Database Migration** — Run Prisma migrations against PostgreSQL
3. **Auth Integration** — Connect to existing user session
4. **Inventory CRUD** — Product masters + batch lots
5. **Session Kit Manager** — CRUD for kits
6. **Drip Builder** — Recipe creation with ingredients
7. **Availability Engine UI** — Real-time check component
8. **Order Flow** — Create → Confirm → Dispatch
9. **Alerts Dashboard** — Expiry + low-stock views
10. **Reports** (future) — Consumption ledger export

---

## Technical Notes

### Unit-Slip Guard
When adding an ingredient, compare `doseUnit` against `master.canonicalUnit`. If mismatch (e.g., dose in mcg for a mg-canonical drug), show inline warning.

### FEFO Implementation
Batches sorted by `expiry ASC` for allocation. Expired batches excluded from all calculations.

### DPDP Compliance
- Patient name is optional on orders
- Patient reference (clinic code) preferred
- All transactions logged for audit trail

### Error Handling
- Mid-operation failures roll back via DB transaction
- Stock cannot go negative
- Concurrent order confirmations handled via optimistic locking

---

## Success Criteria

- [ ] Admin can add product masters with HSN codes
- [ ] Admin can add multiple batches per product (different expiry/brand/strength)
- [ ] Admin can create drips with multiple ingredients
- [ ] Admin can create/edit session kits
- [ ] System shows real-time availability with both pooled + realistic numbers
- [ ] System shows bottleneck ingredient
- [ ] Admin can create and dispatch orders
- [ ] On dispatch, inventory auto-deducts with batch-level tracking
- [ ] Alerts show expired, expiring-soon, and low-stock items
- [ ] Wastage is tracked per dispatch
