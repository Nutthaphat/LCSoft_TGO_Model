# LCSoft_TGO_Model

## Overview

LCSoft_TGO_Model is a desktop application built with **Angular 22** and **Electron** for calculating the carbon footprint of industrial processes.

The application imports process streams, equipment information, and emission factor databases to calculate carbon emissions and visualize the overall process flow.

The system is designed so that engineers and non-programmers can maintain emission factors and reference databases without modifying the source code.

---

# Goals

The application shall:

- Calculate carbon footprint
- Import process streams
- Import equipment data
- Manage emission factor databases
- Visualize process flow
- Display calculation results
- Export reports
- Support long-term maintainability

---

# Technology Stack

## Frontend

- Angular 22
- TypeScript (Strict Mode)
- SCSS
- Angular Signals
- Angular Material
- Hot Toast (ngx-sonner)

## Desktop

- Electron

## Database

- SQLite (.db)

# Dashboard

The Dashboard provides a high-level overview of the carbon footprint results for the currently selected project.

The dashboard should allow users to quickly identify major emission contributors, monitor total emissions, and navigate to detailed sections such as Streams, Equipment, Calculations, and Reports.

The dashboard should remain simple, responsive, and understandable for users without programming or engineering backgrounds.

---

## Dashboard Objectives

The dashboard shall

- Display overall project carbon footprint.
- Display stream emission summary.
- Display equipment emission summary.
- Display emission source usage.
- Highlight major carbon contributors.
- Provide quick project statistics.
- Support filtering and searching.
- Allow users to drill down into detailed views.

---

## Dashboard Layout

Example layout

```text
---------------------------------------------------------
Carbon Footprint Dashboard
---------------------------------------------------------

+-------------+-------------+-------------+-------------+
| Total CO₂e  | Streams     | Equipment   | Sources     |
| 12,540 kg   | 120         | 34          | 4           |
+-------------+-------------+-------------+-------------+

---------------------------------------------------------
Carbon Contribution
---------------------------------------------------------

[ Carbon by Streams ]
[ Carbon by Equipment ]

---------------------------------------------------------
Top Carbon Contributors
---------------------------------------------------------

Reactor-01
Steam System
Pump-05
Stream-210
Heat Exchanger-03

---------------------------------------------------------
Emission Source Usage
---------------------------------------------------------

IPCC
ecoinvent
DEFRA
User Database

---------------------------------------------------------
Recent Calculations
---------------------------------------------------------

Project Name
Calculation Date
Total Carbon
```

---

## KPI Cards

The dashboard should display summary cards.

Required KPI cards

- Total Carbon Footprint
- Total Streams
- Total Equipment
- Total Emission Sources
- Total Stream Emissions
- Total Equipment Emissions

Optional KPI cards

- Highest Carbon Stream
- Highest Carbon Equipment
- Average Carbon per Stream
- Average Carbon per Equipment
- Last Calculation Date

---

## Stream Summary

Display

- Total Streams
- Total Stream Carbon Footprint
- Top Carbon Streams
- Average Stream Carbon Footprint

Users should be able to

- View all streams
- Navigate to Stream Management
- Sort by carbon footprint
- Filter streams

---

## Equipment Summary

Display

- Total Equipment
- Total Equipment Carbon Footprint
- Top Carbon Equipment
- Average Equipment Carbon Footprint

Users should be able to

- View all equipment
- Navigate to Equipment Management
- Sort by carbon footprint
- Filter equipment

---

## Carbon Contribution Charts

Recommended chart types

### Carbon by Category

Bar Chart

Categories

- Streams
- Equipment
- Utilities
- Other Sources

---

### Top Carbon Contributors

Horizontal Bar Chart

Display

- Top 5 contributors
- Top 10 contributors
- Top 20 contributors

Users should be able to switch the displayed amount.

---

### Emission Source Distribution

Donut Chart

Examples

- IPCC
- ecoinvent
- DEFRA
- User Database

Display percentage usage for each source.

---

### Carbon Trend

Line Chart

Display carbon footprint over time.

Examples

- Daily
- Weekly
- Monthly
- Project Versions

---

## Dashboard Filters

Users should be able to filter by

- Project
- Calculation Version
- Emission Source
- Equipment Type
- Date Range
- Stream Category

Changing filters should automatically update all dashboard widgets.

---

## Drill Down Support

Users should be able to click

- KPI Cards
- Streams
- Equipment
- Charts
- Contributors

and navigate directly to the corresponding detailed page.

---

## Dashboard Performance Requirements

The dashboard should

- Load quickly.
- Support large projects.
- Avoid unnecessary recalculations.
- Use cached calculation results when possible.
- Use Angular Signals for state management.
- Update charts reactively.
- Avoid blocking the UI thread.

---

## Dashboard Technology

Recommended technologies

- Angular Material
- Angular Signals
- ngx-echarts
- Apache ECharts

Use ECharts for

- Bar Charts
- Line Charts
- Donut Charts
- Treemap
- Heatmap
- Sankey Diagram (future)

---

## Dashboard Folder Structure

```text
dashboard/

├── pages/
│   └── dashboard.page.ts
│
├── components/
│   ├── kpi-card/
│   ├── carbon-summary-chart/
│   ├── stream-summary/
│   ├── equipment-summary/
│   ├── top-contributors/
│   ├── emission-source-chart/
│   ├── carbon-trend-chart/
│   └── recent-projects/
│
├── services/
│   └── dashboard.service.ts
│
├── models/
│   └── dashboard.model.ts
│
└── store/
    └── dashboard.store.ts
```

---

## Dashboard Development Rules

Always

- Keep charts reusable.
- Keep business logic inside services.
- Use strongly typed interfaces.
- Use Angular Signals.
- Use OnPush change detection.
- Keep components small.
- Load data lazily when possible.
- Avoid duplicate calculations.

Never

- Hardcode chart data.
- Hardcode carbon footprint values.
- Perform calculations inside components.
- Access SQLite directly from components.
- Use `any`.

## Export

- Excel
- PDF

---

# System Architecture

```
┌─────────────────────────────┐
│         Angular UI          │
│ Standalone Components       │
│ Angular Signals             │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│    Application Services     │
│ Business Logic              │
│ Carbon Calculation          │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│        Electron IPC         │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│      SQLite Database        │
└─────────────────────────────┘
```

Business logic must remain inside Angular services.

Components must never communicate directly with SQLite.

Electron handles all database access.

---

# Main Features

## Project Management

Users can

- Create Project
- Open Project
- Save Project
- Export Project

Each project stores

- Stream Data
- Equipment Data
- Selected Emission Sources
- Calculation Results

---

## Stream Management

Users can import stream information including

- Stream ID
- Components
- Flow Rate
- Unit
- Temperature
- Pressure

Each stream contains multiple chemical components.

Each component stores

- Component Name
- Flow Rate
- Unit
- Selected Emission Factor

---

## Equipment Management

Supported equipment includes

- Pump
- Reactor
- Compressor
- Heat Exchanger
- Distillation Column
- Flash Drum

Each equipment stores

- Equipment ID
- Equipment Type
- Heating Duty
- Cooling Duty
- Electricity Consumption
- Energy Unit

---

## Emission Factor Database

SQLite shall be used as the primary database.

Users can

- Add emission factors
- Edit emission factors
- Delete emission factors
- Import emission factors
- Export emission factors
- Backup database
- Restore database
- Replace database

No source code modification should be required.

---

# Database Design

## EmissionSource

| Column | Description |
|---------|-------------|
| Id | Primary Key |
| Name | Source Name |
| Organization | Organization |
| Country | Country |
| Year | Publication Year |
| Version | Database Version |
| Reference | Citation |

---

## EmissionFactor

| Column | Description |
|---------|-------------|
| Id | Primary Key |
| SourceId | FK |
| Category | Material Category |
| Material | Material Name |
| Unit | Unit |
| CarbonFactor | kgCO₂e/unit |
| Description | Notes |

---

## ChemicalComponent

| Column | Description |
|---------|-------------|
| Id | Primary Key |
| Name | Component Name |
| Formula | Chemical Formula |
| MolecularWeight | Molecular Weight |

---

## EquipmentFactor

| Column | Description |
|---------|-------------|
| Id | Primary Key |
| EquipmentType | Equipment |
| EnergyType | Electricity / Steam / Gas |
| CarbonFactor | kgCO₂e/unit |

---

## Project

| Column | Description |
|---------|-------------|
| Id | Primary Key |
| Name | Project Name |
| CreatedDate | Creation Date |

---

# Carbon Footprint Calculation

## Stream Carbon Footprint

Formula

```
Carbon Footprint

=

Flow Rate

×

Emission Factor
```

Users may choose emission sources such as

- IPCC
- ecoinvent
- DEFRA
- User Database

Different projects may use different emission sources.

---

## Equipment Carbon Footprint

Supported energy sources

- Electricity
- Heating
- Cooling

Example

```
Pump Carbon Footprint

=

Electricity Consumption

×

Electricity Emission Factor
```

---

## Total Carbon Footprint

```
Total Carbon Footprint

=

Σ(Stream Carbon Footprint)

+

Σ(Equipment Carbon Footprint)
```

---

# Process Flow Visualization

The application automatically generates an interactive process flow diagram.

Visualization includes

- Streams
- Equipment
- Connections
- Material Flow Direction
- Carbon Footprint

Users can

- Zoom
- Pan
- Search
- Filter
- Highlight Paths
- Select Objects

Selecting a stream displays

- Stream ID
- Stream Name
- Components
- Flow Rate
- Unit
- Selected Emission Source
- Carbon Footprint

Selecting equipment displays

- Equipment ID
- Equipment Type
- Energy Consumption
- Selected Emission Source
- Carbon Footprint Contribution

High-carbon contributors should be highlighted using color indicators.

---

# Reports

Export formats

- Excel
- PDF

Reports include

- Stream Summary
- Equipment Summary
- Emission Factor Summary
- Carbon Footprint Summary
- Total Emissions

---

# Navigation

```
Dashboard

Projects

Streams

Equipment

Emission Database

Calculation

Diagram

Reports

Settings
```

---

# Folder Structure

```
src/
└── app/
    ├── core/
    ├── shared/
    ├── features/
    │   ├── dashboard/
    │   ├── projects/
    │   ├── streams/
    │   ├── equipment/
    │   ├── calculation/
    │   ├── diagram/
    │   ├── database/
    │   ├── reports/
    │   └── settings/
    ├── models/
    ├── services/
    ├── guards/
    ├── directives/
    └── pipes/
```

---

# Angular Development Standards

Always use

- Standalone Components
- Angular Signals
- inject()
- ChangeDetectionStrategy.OnPush
- Lazy Loading
- Reactive Forms
- Strict TypeScript
- Strongly Typed Interfaces
- SCSS

Use Angular control flow syntax

- @if
- @for
- @switch

Avoid

- NgModule
- constructor injection (unless required)
- *ngIf
- *ngFor
- any
- Deprecated Angular APIs

---
## Development Rules

Before implementing any feature or writing code:

1. Analyze the request.
2. Explain the implementation plan.
3. Break the work into clear steps.
4. Identify any assumptions or missing requirements.
5. Wait for approval before making major architectural changes or implementing large features.
6. After the plan is approved, implement the solution.

# Coding Guidelines

When generating code

- Follow Angular 22 best practices.
- Keep business logic inside services.
- Components should remain focused on UI.
- Never hardcode emission factors.
- Read all calculation data from SQLite.
- Use strongly typed interfaces.
- Prefer Signals over RxJS when appropriate.
- Avoid duplicate code.
- Write reusable components.
- Include unit tests for business logic.
- Keep code readable and maintainable.

---

# Non-functional Requirements

The application should prioritize

- Performance
- Maintainability
- Scalability
- Testability
- Offline capability
- Large dataset support
- Clean Architecture
- Responsive UI
- Easy database maintenance

---#   L C S o f t _ T G O  
 