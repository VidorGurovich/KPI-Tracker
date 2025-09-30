# Tasks: KPI Tracker with Manager and Employee Roles

**Input**: Design documents from `/specs/001-kpi-tracker-with/`
**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → ✅ LOADED: Electron + React + TypeScript + SQLite desktop app
   → ✅ EXTRACTED: Library-first architecture, TDD mandatory
2. Load design documents:
   → ✅ data-model.md: 7 entities (User, Team, KPIGroup, etc.)
   → ✅ contracts/: 4 API contract files (auth, teams, kpis, performance)
   → ✅ research.md: Technical decisions (Chart.js, better-sqlite3, JWT)
   → ✅ quickstart.md: End-to-end validation workflow
3. Generate tasks by category:
   → ✅ Setup: Electron project, dependencies, database
   → ✅ Tests: 4 contract test files + 7 integration scenarios
   → ✅ Core: 7 models + 4 service libraries + CLI interfaces
   → ✅ Integration: Database setup, authentication, API routing
   → ✅ Polish: UI components, charts, validation, documentation
4. Apply task rules:
   → ✅ Contract tests [P] - different files, independent
   → ✅ Models [P] - separate entity files
   → ✅ Sequential for shared files (API routes, services)
5. Number tasks sequentially (T001-T042)
6. Validate dependencies: Tests → Models → Services → APIs → UI
7. Create parallel execution examples
8. ✅ SUCCESS: 42 tasks ready for TDD execution
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- All paths relative to repository root

## Path Conventions (Single Desktop Project)
- **Source**: `src/` (models, services, cli, renderer, main)
- **Tests**: `tests/` (contract, integration, e2e, unit)
- **Database**: `database/` (migrations, seeds)
- **Assets**: `assets/` (icons, images)

## Phase 3.1: Project Setup

- [ ] **T001** Create Electron + React + TypeScript project structure in repository root
  - Initialize package.json with Electron, React, TypeScript dependencies
  - Configure tsconfig.json for main/renderer processes
  - Set up Webpack configuration for Electron app
  - Create src/main/, src/renderer/, src/shared/ directories

- [ ] **T002** [P] Install and configure development dependencies
  - ESLint + Prettier for code quality
  - Jest for unit testing, Playwright for E2E
  - better-sqlite3, jsonwebtoken, nodemailer, bcrypt
  - Chart.js, react-chartjs-2 for analytics

- [ ] **T003** [P] Set up database structure and migrations
  - Create database/migrations/ directory
  - Migration scripts for 7 entities from data-model.md
  - Database connection utilities in src/shared/database.ts
  - Seed data for testing in database/seeds/

## Phase 3.2: Contract Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

- [ ] **T004** [P] Contract test for Authentication API in tests/contract/auth.test.ts
  - POST /api/auth/register endpoint schema validation
  - POST /api/auth/login endpoint schema validation  
  - POST /api/auth/verify endpoint schema validation
  - Error response format validation

- [ ] **T005** [P] Contract test for Teams API in tests/contract/teams.test.ts
  - POST /api/teams endpoint schema validation
  - GET /api/teams/managed endpoint schema validation
  - GET /api/teams/{id}/members endpoint schema validation
  - Team member management endpoints schema validation

- [ ] **T006** [P] Contract test for KPIs API in tests/contract/kpis.test.ts
  - POST /api/kpis/groups endpoint schema validation
  - GET /api/kpis/assigned endpoint schema validation
  - POST /api/kpis/assignments endpoint schema validation
  - KPI group and definition structure validation

- [ ] **T007** [P] Contract test for Performance API in tests/contract/performance.test.ts
  - POST /api/performance/records endpoint schema validation
  - GET /api/performance/user/{id} endpoint schema validation
  - GET /api/performance/trends/{instanceId} endpoint schema validation
  - Score calculation response validation

## Phase 3.3: Integration Test Scenarios (TDD)

- [ ] **T008** [P] Integration test: Manager registration and team creation in tests/integration/manager-workflow.test.ts
  - Manager registers → verifies email → logs in
  - Creates team → adds employees → views team dashboard
  - Uses real SQLite database for full workflow

- [ ] **T009** [P] Integration test: KPI group creation and assignment in tests/integration/kpi-workflow.test.ts
  - Manager creates KPI group with multiple definitions
  - Assigns KPI group to team member
  - Validates KPI instances created automatically

- [ ] **T010** [P] Integration test: Performance tracking workflow in tests/integration/performance-workflow.test.ts
  - Manager records performance for team member KPIs
  - Score calculation works correctly for different target types
  - Performance history and trends generate properly

- [ ] **T011** [P] Integration test: Employee dashboard experience in tests/integration/employee-workflow.test.ts
  - Employee logs in → views assigned KPIs
  - Sees performance history and charts
  - Analytics display correctly with real data

## Phase 3.4: Data Models (ONLY after tests are failing)

- [ ] **T012** [P] User model in src/models/User.ts
  - TypeScript interface and SQLite schema
  - Password hashing, email validation
  - Role-based access methods (isManager, isEmployee)

- [ ] **T013** [P] Team model in src/models/Team.ts
  - Team entity with manager relationship
  - Member management methods
  - Team performance aggregation queries

- [ ] **T014** [P] KPIGroup model in src/models/KPIGroup.ts
  - KPI group with definitions collection
  - Assignment methods to users
  - Active/inactive status management

- [ ] **T015** [P] KPIDefinition model in src/models/KPIDefinition.ts
  - Comprehensive KPI structure from data-model.md
  - Category, frequency, target, weight properties
  - Validation for measurement criteria

- [ ] **T016** [P] KPIInstance model in src/models/KPIInstance.ts
  - Link between KPI definition and user
  - Assignment tracking and status
  - Performance record relationships

- [ ] **T017** [P] PerformanceRecord model in src/models/PerformanceRecord.ts
  - Performance measurement storage
  - Score calculation methods
  - Period tracking and validation

- [ ] **T018** [P] Database repository base class in src/models/BaseRepository.ts
  - Common CRUD operations for all models
  - Transaction management
  - Error handling and logging

## Phase 3.5: Service Libraries

- [ ] **T019** [P] Authentication service library in src/lib/auth-lib/
  - JWT token generation and validation
  - Email verification workflow with nodemailer
  - Password reset functionality
  - CLI interface: auth-cli --register, --login, --verify

- [ ] **T020** [P] User management service library in src/lib/user-lib/
  - User CRUD operations with role validation
  - Team creation and member management
  - User search and filtering
  - CLI interface: user-cli --create-team, --add-member

- [ ] **T021** [P] KPI management service library in src/lib/kpi-lib/
  - KPI group and definition management
  - Assignment logic and validation
  - KPI instance lifecycle management
  - CLI interface: kpi-cli --create-group, --assign

- [ ] **T022** Analytics service library in src/lib/analytics-lib/
  - Performance calculation and aggregation
  - Trend analysis and scoring algorithms
  - Chart data preparation for visualization
  - CLI interface: analytics-cli --generate-report, --trends
  - Dependencies: T021 (needs KPI data)

## Phase 3.6: API Implementation

- [ ] **T023** Main process setup in src/main/main.ts
  - Electron main process initialization
  - Database connection and migration runner
  - IPC communication setup with renderer
  - Application lifecycle management

- [ ] **T024** Authentication API routes in src/main/api/auth.ts
  - POST /api/auth/register, /login, /verify endpoints
  - Middleware for JWT validation
  - Rate limiting for security
  - Dependencies: T019 (auth service)

- [ ] **T025** Teams API routes in src/main/api/teams.ts
  - Team CRUD endpoints with manager authorization
  - Member management endpoints
  - Team performance summary endpoints
  - Dependencies: T020 (user service)

- [ ] **T026** KPIs API routes in src/main/api/kpis.ts
  - KPI group management endpoints
  - Assignment and instance management
  - Employee KPI dashboard endpoints
  - Dependencies: T021 (KPI service)

- [ ] **T027** Performance API routes in src/main/api/performance.ts
  - Performance recording with validation
  - Trend analysis and analytics endpoints
  - Score calculation integration
  - Dependencies: T022 (analytics service)

## Phase 3.7: Frontend Components

- [ ] **T028** [P] Authentication components in src/renderer/components/Auth/
  - LoginForm, RegisterForm, EmailVerification components
  - Form validation with React Hook Form
  - Error handling and loading states

- [ ] **T029** [P] Manager dashboard components in src/renderer/components/Manager/
  - TeamManagement, KPIGroupCreation, PerformanceTracking
  - Role-based access control integration
  - Team member selection and KPI assignment

- [ ] **T030** [P] Employee dashboard components in src/renderer/components/Employee/
  - KPIDashboard, PerformanceHistory, MyTeams
  - Read-only KPI display with progress indicators
  - Personal performance analytics

- [ ] **T031** [P] Chart components in src/renderer/components/Charts/
  - TrendChart, PerformanceGauge, CategoryBreakdown
  - Chart.js integration with TypeScript
  - Responsive design for desktop windows

- [ ] **T032** React Router setup in src/renderer/App.tsx
  - Route configuration with role-based access
  - Protected routes for manager/employee features
  - Navigation components and layout
  - Dependencies: T028, T029, T030 (components)

## Phase 3.8: Integration & Polish

- [ ] **T033** IPC communication layer in src/shared/ipc.ts
  - Type-safe IPC channels for main/renderer communication
  - API call wrappers for renderer process
  - Error handling and response formatting

- [ ] **T034** State management in src/renderer/context/
  - React Context for authentication state
  - KPI data state management
  - Team and user state management

- [ ] **T035** [P] Unit tests for services in tests/unit/
  - Authentication service unit tests
  - KPI calculation algorithm tests
  - Score calculation validation tests

- [ ] **T036** [P] E2E tests with Playwright in tests/e2e/
  - Complete quickstart.md workflow automation
  - Cross-platform desktop app testing
  - Screenshot comparison for UI consistency

- [ ] **T037** Database migration system in src/shared/migrations.ts
  - Automatic schema version management
  - Migration rollback capabilities
  - Data integrity validation

- [ ] **T038** Application packaging in build/
  - Electron Builder configuration
  - Cross-platform installers (Windows, macOS, Linux)
  - Auto-updater setup for production

- [ ] **T039** [P] Performance optimization
  - Chart rendering optimization with React.memo
  - Database query optimization and indexing
  - Memory leak prevention and profiling

- [ ] **T040** [P] Security hardening
  - Content Security Policy configuration
  - Secure IPC communication validation
  - SQL injection prevention validation

- [ ] **T041** [P] Documentation updates
  - API documentation generation
  - User manual and installation guide
  - Developer setup instructions

- [ ] **T042** Final validation with quickstart.md
  - Execute complete 15-minute workflow
  - Validate all functional requirements
  - Performance benchmarking against targets

## Dependencies

### Critical Path
- **Setup** (T001-T003) → **Contract Tests** (T004-T007) → **Models** (T012-T018) → **Services** (T019-T022) → **APIs** (T024-T027) → **Frontend** (T032) → **E2E** (T036)

### Service Dependencies
- T022 (analytics) depends on T021 (KPI service)
- T024-T027 (APIs) depend on respective services T019-T022
- T032 (routing) depends on T028-T031 (components)

### Test Dependencies (TDD)
- All implementation tasks (T012+) MUST wait for contract tests (T004-T007) to be written and FAIL
- Integration tests (T008-T011) can run parallel with contract tests
- E2E tests (T036) require complete application (T001-T035)

## Parallel Execution Examples

### Phase 1: Contract Tests (Can run simultaneously)
```bash
Task: "Contract test for Authentication API in tests/contract/auth.test.ts"
Task: "Contract test for Teams API in tests/contract/teams.test.ts"  
Task: "Contract test for KPIs API in tests/contract/kpis.test.ts"
Task: "Contract test for Performance API in tests/contract/performance.test.ts"
```

### Phase 2: Data Models (Independent files)
```bash
Task: "User model in src/models/User.ts"
Task: "Team model in src/models/Team.ts"
Task: "KPIGroup model in src/models/KPIGroup.ts"
Task: "KPIDefinition model in src/models/KPIDefinition.ts"
```

### Phase 3: Service Libraries (Independent libraries)
```bash
Task: "Authentication service library in src/lib/auth-lib/"
Task: "User management service library in src/lib/user-lib/"
Task: "KPI management service library in src/lib/kpi-lib/"
# Note: analytics-lib waits for KPI-lib completion
```

## Notes
- **TDD Mandatory**: All tests must be written and failing before implementation
- **[P] Tasks**: Different files, no shared dependencies, can run parallel
- **Library-First**: Each service must have CLI interface for standalone testing
- **Constitutional Compliance**: Real SQLite database, no mocks in integration tests
- **Performance Targets**: <500ms UI response, support 1000+ KPI records per user

## Validation Checklist
*GATE: Must pass before task execution*

- [x] All 4 contract files have corresponding test tasks (T004-T007)
- [x] All 7 entities have model creation tasks (T012-T018)
- [x] All contract tests scheduled before implementation
- [x] All [P] tasks are truly independent (different files)
- [x] Each task specifies exact file path
- [x] Service dependencies properly ordered (analytics after KPI)
- [x] TDD workflow enforced: Tests → Models → Services → APIs → UI
- [x] Complete quickstart validation included (T042)

**Total Tasks**: 42  
**Estimated Duration**: 3-4 weeks for experienced developer  
**Critical Path**: Setup → Tests → Models → Services → APIs → UI → Validation
