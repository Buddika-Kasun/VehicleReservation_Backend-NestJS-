# Backend Folder Structure Refactoring

## Overview

The backend codebase has been reorganized to improve maintainability, scalability, and clarity. The structure now distinguishes between **Core** modules (fundamental infrastructure) and **Feature** modules (business logic).

## New Structure

```
src/
├── common/             # Shared utilities, guards, decorators, filters
├── config/             # Configuration files
├── database/           # Database entities, migrations, seeds
├── modules/
│   ├── core/           # Infrastructure and foundational modules
│   │   ├── auth/       # Authentication & Authorization
│   │   ├── audit/      # Audit logging
│   │   ├── health/     # Health checks
│   │   └── notifications/ # Real-time & Push Notifications
│   │
│   └── features/       # Business logic modules
│       ├── users/      # User management
│       ├── trips/      # Trip management
│       ├── vehicles/   # Vehicle management
│       ├── company/    # Company & Cost Configuration
│       ├── department/ # Department management
│       ├── feedback/   # Feedback system
│       ├── reports/    # Reporting
│       └── ...         # Other feature modules
└── main.ts             # Application entry point
```

## Module Categorization

### Core Modules (`src/modules/core`)

These modules provide essential services used across the application but are not tied to specific business domains.

- **Auth**: Handles JWT strategies, guards, and login/register logic.
- **Audit**: Tracks user actions and application events.
- **Health**: Provides endpoints for system monitoring (`/health`).
- **Notifications**: Centralized service for In-App (WebSocket) and Push (Firebase) notifications.

### Feature Modules (`src/modules/features`)

These modules implement the specific business requirements of the Vehicle Reservation System.

- **Users**: User profiles, roles, and approval workflows.
- **Trips**: Trip requests, approvals, scheduling, and execution.
- **Vehicles**: Vehicle inventory, status, and assignment.
- **Others**: Company, Department, CostCenter, etc.

## Import Guidelines

- **Relative Imports**: Use relative imports for files within the same module (e.g., `import { CreateTripDto } from './dto/create-trip.dto'`).
- **Absolute Imports**: Use absolute imports (mapped to `src/`) for crossing module boundaries or importing common utilities (e.g., `import { ResponseService } from 'src/common/services/response.service'`).
- **Avoid**: Deep relative imports (e.g., `../../../../common`) as they break easily during refactoring.

## Migration Notes

If you are used to the old structure (`src/modules/*`), please note:

- All business modules are now in `src/modules/features/*`.
- `AuthModule` is in `src/modules/core/auth`.
- `NotificationsModule` is in `src/modules/core/notifications`.
