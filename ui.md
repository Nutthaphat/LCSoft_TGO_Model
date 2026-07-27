---

# AI Development Instructions

This document serves as the primary development guide for AI assistants.

When generating code, always follow the rules below.

## General Rules

- Follow Angular 22 best practices.
- Follow the existing project folder structure.
- Reuse existing components whenever possible.
- Modify existing files before creating new files.
- Never generate duplicate business logic.
- Prefer composition over inheritance.
- Keep components reusable.
- Keep code readable and maintainable.
- Avoid unnecessary abstractions.
- Do not generate placeholder implementations unless explicitly requested.

---

# UI Design System

Desktop First

Minimum Resolution

```
1366 × 768
```

Spacing

```
8px Grid System
```

Border Radius

```
12px
```

Charts

- Apache ECharts

Icons

- Material Symbols

Theme

- Light Theme

Color Recommendation

Primary

```
#2E7D32
```

Warning

```
#F9A825
```

Danger

```
#C62828
```

Information

```
#1976D2
```

---

# Error Handling

Services should

- Validate inputs.
- Return typed results.
- Log failures.
- Throw only business exceptions.

Components should

- Display user-friendly messages.
- Never expose stack traces.
- Show toast notifications.

Electron should

- Log all IPC errors.
- Handle database exceptions.
- Recover from SQLite failures whenever possible.

---

# Testing Standards

Write Unit Tests for

- Calculation Engine
- Services
- Stores
- Repository
- Utility Functions

UI Tests

- Critical Components
- Navigation
- Dashboard

Target

- 80%+ business logic coverage