# GitHub Copilot Instructions

You are GitHub Copilot working on the KPI Tracker desktop application. This is a comprehensive performance management system built with Electron, React, TypeScript, and SQLite.

## Project Overview

**Current Feature**: KPI Tracker with Manager and Employee Roles  
**Branch**: `001-kpi-tracker-with`  
**Architecture**: Desktop application with library-first design  
**Tech Stack**: Electron 26+, React 18+, TypeScript 5.0+, SQLite3, JWT authentication

## Core Context

### Application Purpose
Desktop KPI tracking system where:
- **Managers** create teams, design KPI groups, assign KPIs, track performance
- **Employees** view assigned KPIs, monitor progress, see performance analytics
- **System** calculates weighted scores, generates trends, provides insights

### Key Data Models
```typescript
// Core entities with relationships
User: id, email, role ('manager'|'employee'|'both'), emailVerified
Team: id, name, managerId, members[]
KPIGroup: id, name, description, definitions[], createdBy
KPIDefinition: category, metricName, frequency, targetType, targetValue, weight
KPIInstance: definitionId, userId, assignedAt, active
PerformanceRecord: instanceId, value, score, period, recordedBy
```

### KPI Structure (Real-world Example)
```typescript
interface KPIDefinition {
  category: 'Process & time' | 'Board hygiene' | 'Planning & estimation' | 'Delivery' | 'Hygiene' | 'Quality';
  metricName: string; // e.g., "Daily time logging (DevOps)"
  description: string; // Detailed explanation
  frequency: 'Daily' | 'Weekly' | 'Sprint' | 'Monthly';
  targetType: 'percentage' | 'numeric' | 'boolean' | 'string';
  targetValue: string; // e.g., "≥95%", "≤1", "Yes"
  measurementMethod: string; // How it's measured
  dataSource: string; // Where data comes from
  reviewCadence: string; // When it's reviewed
  weight: number; // 1-10 importance
}
```

## Development Principles

### Architecture Rules
- **Library-First**: Every feature as standalone library with CLI interface
- **TDD Mandatory**: Tests before implementation, RED-GREEN-REFACTOR cycle
- **Direct Framework Usage**: No wrapper classes, use Electron/React directly
- **Single Data Model**: Unified schema, avoid DTOs unless serialization differs

### Library Structure
```
src/
├── lib/
│   ├── auth-lib/          # JWT, email verification, password hashing
│   ├── user-lib/          # User management, team operations  
│   ├── kpi-lib/           # KPI CRUD, scoring, assignment logic
│   └── analytics-lib/     # Charts, trends, insights generation
├── services/              # Business logic combining libraries
├── renderer/              # React UI components
├── main/                  # Electron main process
└── shared/                # Common types and utilities
```

### Testing Strategy
```
tests/
├── contract/              # API schema validation
├── integration/           # Real SQLite database tests
├── e2e/                   # Playwright full workflows
└── unit/                  # Library function tests
```

## Technical Implementation

### Database (SQLite)
- **Connection**: better-sqlite3 for synchronous operations
- **Migrations**: Versioned schema changes in database/migrations/
- **Indexes**: Optimized for user_id, team_id, date range queries
- **JSON Columns**: For flexible KPI metadata storage

### Authentication
- **JWT Tokens**: Stateless authentication with refresh capability
- **Email Verification**: nodemailer with SMTP configuration
- **Password Security**: bcrypt hashing with complexity requirements
- **Storage**: Electron secure storage API (not browser localStorage)

### Frontend (React + TypeScript)
- **State Management**: React Context + useReducer (no Redux needed)
- **Charts**: Chart.js with react-chartjs-2 for KPI visualizations
- **Forms**: React Hook Form with validation
- **Styling**: CSS Modules or styled-components
- **Performance**: React.memo for chart components, virtualized lists

### Score Calculation
```typescript
function calculateScore(value: string, target: KPITarget): number {
  switch (target.type) {
    case 'percentage':
      return calculatePercentageScore(parseFloat(value), target.threshold);
    case 'boolean':
      return value.toLowerCase() === 'yes' ? 100 : 0;
    case 'numeric':
      return calculateNumericScore(parseFloat(value), target);
    default:
      return 0; // Manual scoring required
  }
}
```

## Code Generation Guidelines

### When Writing Components
- Use TypeScript interfaces for all props and state
- Include proper error handling and loading states
- Add accessibility attributes (ARIA labels, keyboard navigation)
- Use React.memo for performance-critical components
- Include JSDoc comments for complex business logic

### When Writing APIs
- Follow RESTful conventions with consistent error responses
- Include request/response TypeScript interfaces
- Add input validation with clear error messages
- Use proper HTTP status codes (200, 201, 400, 401, 403, 404)
- Include rate limiting for authentication endpoints

### When Writing Database Code
- Use prepared statements for security and performance
- Include proper error handling and transaction management
- Add database constraints and foreign key relationships
- Create indexes for commonly queried columns
- Use migrations for schema changes

### When Writing Tests
- Start with failing test (RED phase)
- Use real dependencies (actual SQLite database)
- Follow naming: `describe('Component/Function')` and `it('should behavior')`
- Include both happy path and error scenarios
- Test edge cases and boundary conditions

## Common Patterns

### Error Handling
```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}
```

### Chart Data Preparation
```typescript
interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
  }[];
}
```

### KPI Assignment Flow
```typescript
// 1. Validate manager has access to user
// 2. Create KPI instances for each definition in group
// 3. Set all instances as active
// 4. Return assignment summary
```

## Recent Changes

### Latest Specifications (September 2025)
- Comprehensive KPI structure with 6 categories
- Weighted scoring system with performance analytics
- Frequency-based tracking (daily, weekly, sprint, monthly)
- Email authentication with verification workflow
- Desktop-first design (not web application)

### Current Development Phase
- **Phase 1 Complete**: Research, data model, contracts, quickstart
- **Phase 2 Ready**: Task generation for implementation
- **Focus Areas**: Authentication system, KPI management core, performance tracking

## File Locations

### Specifications
- Main spec: `/specs/001-kpi-tracker-with/spec.md`
- Data model: `/specs/001-kpi-tracker-with/data-model.md`
- API contracts: `/specs/001-kpi-tracker-with/contracts/`
- Quickstart: `/specs/001-kpi-tracker-with/quickstart.md`

### Implementation (When Created)
- Source code: `/src/`
- Tests: `/tests/`
- Database: `/database/`
- Documentation: `/docs/`

---

**Remember**: This is a TDD project. Always write failing tests first, then implement to make them pass. Focus on creating reusable libraries with clear CLI interfaces.
