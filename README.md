# EventsHQ — 360° Events Management

A full-stack web application for managing Corporate/B2B events (conferences, trade shows, client summits, sales kickoffs) covering three pillars: Sourcing & Vendors, Budgeting & Finance, and Execution & Logistics.

## Tech Stack

- **Next.js 14** with App Router
- **SQLite** via `better-sqlite3`
- **Tailwind CSS**
- TypeScript

## Setup & Run

### Prerequisites

Node.js 18+ must be installed.

### Install Dependencies

```bash
npm install
```

### Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## Features

### Dashboard (`/`)
- Summary cards: Total Events, Active Events, Total Budget, Upcoming Events (next 30 days)
- Recent events table with status badges
- Quick "New Event" button

### Events List (`/events`)
- Filter by status and type
- Full CRUD operations

### Create Event (`/events/new`)
- Form with all event fields

### Event Detail (`/events/[id]`) — 4 Tabs

**Overview Tab**
- Full event info with inline editing
- Key metrics: Budget Used %, Vendor Count, Task Completion %, Staff Count
- Budget breakdown bar chart by category

**Vendors Tab**
- Pipeline summary (RFP Sent → Shortlisted → Contracted → Rejected → Completed)
- Add vendors from global directory or create new on the fly
- Edit contract value, status, notes

**Budget Tab**
- Planned vs. Actual summary with progress bar
- Line items grouped by category
- Color-coded overage (red if actual > planned)
- Track PO numbers and invoice numbers

**Execution Tab**
- **Tasks**: Full task management with priority badges, status toggle (click to cycle)
- **Run of Show**: Timeline grouped by day, sortable by time
- **Staffing**: Staff roster with arrival/departure and hotel info

### Vendor Directory (`/vendors`)
- Global vendor database with search and category filter
- Full CRUD operations

## Database

SQLite database file (`events.db`) is created automatically in the project root on first run. Seed data is inserted on first startup including:
- 3 sample events (TechSummit 2026, Q2 Sales Kickoff, Enterprise Client Summit)
- 5 vendors with contact info
- Budget items, tasks, run-of-show, and staff for TechSummit 2026

## Project Structure

```
/app
  layout.tsx              — global layout with dark sidebar nav
  page.tsx                — dashboard
  /events
    page.tsx              — events list
    /new/page.tsx         — create event form
    /[id]/
      page.tsx            — event detail with tabs
      OverviewTab.tsx     — overview tab component
      VendorsTab.tsx      — vendors tab component
      BudgetTab.tsx       — budget tab component
      ExecutionTab.tsx    — tasks/ros/staff tab component
      types.tsx           — shared types and components
  /vendors
    page.tsx              — global vendor directory
/lib
  db.ts                   — SQLite connection + schema + seed data
/app/api/
  events/                 — events CRUD + nested resources
  vendors/                — vendors CRUD
```
