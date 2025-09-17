-- Migration: Initial schema for KPI Tracker
-- Version: 001
-- Date: 2025-09-17

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- User table for authentication and role management
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

-- Team table for organizing employees under managers
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

-- Junction table for team membership
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

-- KPI Groups for organizing related metrics
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

-- KPI Definitions with comprehensive measurement criteria
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

-- KPI Instances linking definitions to users
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

-- Performance records for tracking KPI measurements
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

-- Views for common queries
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

CREATE VIEW v_team_performance AS
SELECT 
    t.id as team_id,
    t.name as team_name,
    u.id as user_id,
    u.first_name || ' ' || u.last_name as user_name,
    COUNT(ki.id) as assigned_kpis,
    AVG(pr.score) as avg_score,
    MIN(pr.recorded_at) as oldest_record,
    MAX(pr.recorded_at) as latest_record
FROM teams t
JOIN team_members tm ON t.id = tm.team_id
JOIN users u ON tm.user_id = u.id
LEFT JOIN kpi_instances ki ON u.id = ki.user_id AND ki.is_active = TRUE
LEFT JOIN performance_records pr ON ki.id = pr.instance_id
GROUP BY t.id, t.name, u.id, u.first_name, u.last_name;
