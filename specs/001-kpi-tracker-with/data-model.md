# Data Model: KPI Tracker

**Date**: September 15, 2025  
**Database**: SQLite with better-sqlite3  
**Schema Version**: 1.0.0

## Entity Relationship Overview

```
User (1) ←→ (M) TeamMember (M) ←→ (1) Team
User (1) ←→ (M) KPIGroup (created_by)
User (1) ←→ (M) KPIInstance (assigned KPIs)
User (1) ←→ (M) PerformanceRecord (recorded_by)

KPIGroup (1) ←→ (M) KPIDefinition
KPIDefinition (1) ←→ (M) KPIInstance
KPIInstance (1) ←→ (M) PerformanceRecord
```

## Core Entities

### User
**Purpose**: Manages authentication and role-based access for managers and employees
**Relationships**: Can belong to multiple teams, create KPI groups, have assigned KPIs

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('manager', 'employee', 'both')),
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

**Validation Rules**:
- Email must be valid format and unique
- Password minimum 8 characters with complexity requirements
- Role must be 'manager', 'employee', or 'both'
- Email verification required before full access

### Team
**Purpose**: Groups employees under manager supervision for KPI assignment
**Relationships**: Managed by one user, contains multiple team members

```sql
CREATE TABLE teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    manager_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_teams_manager ON teams(manager_id);
```

**Validation Rules**:
- Team name must be unique per manager
- Manager must have 'manager' or 'both' role
- Description optional but recommended

### TeamMember
**Purpose**: Junction table linking users to teams with membership tracking
**Relationships**: Links User and Team entities with metadata

```sql
CREATE TABLE team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    role_in_team VARCHAR(50) DEFAULT 'member',
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
```

**Business Rules**:
- User can belong to multiple teams
- Manager can be member of teams they don't manage
- Unique constraint prevents duplicate memberships

### KPIGroup
**Purpose**: Named collections of related KPI definitions for role-based assignment
**Relationships**: Created by managers, contains multiple KPI definitions

```sql
CREATE TABLE kpi_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_kpi_groups_creator ON kpi_groups(created_by);
CREATE INDEX idx_kpi_groups_active ON kpi_groups(is_active);
```

**Examples**: "Intern Developers", "Senior Developers", "QA Engineers"
**Validation Rules**:
- Name must be unique per creator
- Only managers can create KPI groups
- Groups can be deactivated but not deleted (preserve history)

### KPIDefinition
**Purpose**: Individual performance metrics with comprehensive measurement criteria
**Relationships**: Belongs to KPI group, spawns multiple instances when assigned

```sql
CREATE TABLE kpi_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    category VARCHAR(100) NOT NULL,
    metric_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('Daily', 'Weekly', 'Sprint', 'Monthly')),
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('percentage', 'numeric', 'boolean', 'string')),
    target_value VARCHAR(100) NOT NULL,
    measurement_method TEXT NOT NULL,
    data_source VARCHAR(255) NOT NULL,
    review_cadence VARCHAR(100) NOT NULL,
    weight INTEGER NOT NULL CHECK (weight > 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES kpi_groups(id) ON DELETE CASCADE
);

CREATE INDEX idx_kpi_definitions_group ON kpi_definitions(group_id);
CREATE INDEX idx_kpi_definitions_category ON kpi_definitions(category);
CREATE INDEX idx_kpi_definitions_frequency ON kpi_definitions(frequency);
```

**Category Examples**: "Process & time", "Board hygiene", "Planning & estimation", "Delivery", "Hygiene", "Quality"
**Target Examples**: "≥95%", "≤1", "Yes", "Within 1 business day"
**Validation Rules**:
- Weight must be positive integer (typically 1-10)
- Target value format must match target_type
- Measurement method required for transparency

### KPIInstance
**Purpose**: Assignment of KPI definition to specific user, creating trackable instance
**Relationships**: Links KPI definition to user, spawns performance records

```sql
CREATE TABLE kpi_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    definition_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    assigned_by INTEGER NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    FOREIGN KEY (definition_id) REFERENCES kpi_definitions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT,
    UNIQUE(definition_id, user_id)
);

CREATE INDEX idx_kpi_instances_definition ON kpi_instances(definition_id);
CREATE INDEX idx_kpi_instances_user ON kpi_instances(user_id);
CREATE INDEX idx_kpi_instances_assigned_by ON kpi_instances(assigned_by);
```

**Business Rules**:
- One instance per definition per user (unique constraint)
- Instance inherits all properties from definition
- Can be deactivated without losing historical data
- Assigned_by must be manager with access to user

### PerformanceRecord
**Purpose**: Timestamped measurements of KPI performance with period tracking
**Relationships**: Records performance for KPI instance over specific periods

```sql
CREATE TABLE performance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id INTEGER NOT NULL,
    value VARCHAR(255) NOT NULL,
    recorded_by INTEGER NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    notes TEXT,
    score DECIMAL(5,2), -- Calculated score based on target achievement
    FOREIGN KEY (instance_id) REFERENCES kpi_instances(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_performance_records_instance ON performance_records(instance_id);
CREATE INDEX idx_performance_records_period ON performance_records(period_start, period_end);
CREATE INDEX idx_performance_records_recorded_by ON performance_records(recorded_by);
CREATE INDEX idx_performance_records_score ON performance_records(score);
```

**Value Examples**: "98%", "2", "Yes", "Same day"
**Score Calculation**: 0-100 based on target achievement
**Period Tracking**: Aligns with KPI frequency (daily, weekly, sprint, monthly)

## Derived Views

### User KPI Summary
**Purpose**: Aggregated view of user's current KPI performance
```sql
CREATE VIEW v_user_kpi_summary AS
SELECT 
    u.id as user_id,
    u.first_name || ' ' || u.last_name as user_name,
    kd.category,
    kd.metric_name,
    ki.id as instance_id,
    pr.value as latest_value,
    pr.score as latest_score,
    pr.period_start,
    pr.period_end,
    kd.target_value,
    kd.weight
FROM users u
JOIN kpi_instances ki ON u.id = ki.user_id
JOIN kpi_definitions kd ON ki.definition_id = kd.id
LEFT JOIN performance_records pr ON ki.id = pr.instance_id
WHERE ki.is_active = TRUE
  AND kd.is_active = TRUE
  AND pr.id = (
    SELECT MAX(id) FROM performance_records 
    WHERE instance_id = ki.id
  );
```

### Team Performance Dashboard
**Purpose**: Manager view of team's KPI performance
```sql
CREATE VIEW v_team_performance AS
SELECT 
    t.id as team_id,
    t.name as team_name,
    u.id as user_id,
    u.first_name || ' ' || u.last_name as user_name,
    COUNT(ki.id) as active_kpis,
    AVG(pr.score) as avg_score,
    COUNT(pr.id) as records_count
FROM teams t
JOIN team_members tm ON t.id = tm.team_id
JOIN users u ON tm.user_id = u.id
LEFT JOIN kpi_instances ki ON u.id = ki.user_id AND ki.is_active = TRUE
LEFT JOIN performance_records pr ON ki.id = pr.instance_id
GROUP BY t.id, t.name, u.id, u.first_name, u.last_name;
```

## Data Validation Rules

### Business Logic Constraints
1. **Role Validation**: Only managers can create teams and KPI groups
2. **Team Membership**: Users can only be assigned KPIs by managers of their teams
3. **Frequency Alignment**: Performance records must align with KPI frequency
4. **Score Calculation**: Automated scoring based on target achievement
5. **Historical Integrity**: Deactivation preserves data, deletion removes history

### Data Integrity
1. **Referential Integrity**: All foreign keys with appropriate CASCADE/RESTRICT
2. **Unique Constraints**: Prevent duplicate assignments and memberships
3. **Check Constraints**: Validate enums and positive values
4. **Index Strategy**: Optimized for common query patterns

### Audit Trail
- All tables include created_at/updated_at timestamps
- Performance records include recorded_by for accountability
- Soft deletion (is_active flags) preserves historical data
- Version tracking for schema migrations

---

**Schema Status**: ✅ Complete - Ready for implementation  
**Migration Scripts**: Required for production deployment  
**Test Data**: Available in seeds/ directory
