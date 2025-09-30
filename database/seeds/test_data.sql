-- Seed data for KPI Tracker development and testing
-- Run after initial migration

-- Test users with different roles
INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified) VALUES
  ('manager@test.com', '$2b$10$test.hash1', 'Alice', 'Manager', 'manager', TRUE),
  ('employee@test.com', '$2b$10$test.hash2', 'Bob', 'Employee', 'employee', TRUE),
  ('both@test.com', '$2b$10$test.hash3', 'Carol', 'Both', 'both', TRUE),
  ('intern@test.com', '$2b$10$test.hash4', 'Dave', 'Intern', 'employee', TRUE);

-- Test team
INSERT INTO teams (name, description, manager_id) VALUES
  ('Development Team', 'Frontend and backend developers', 1),
  ('QA Team', 'Quality assurance specialists', 3);

-- Team memberships
INSERT INTO team_members (team_id, user_id, role_in_team) VALUES
  (1, 2, 'developer'),
  (1, 4, 'intern'),
  (2, 2, 'tester'),
  (2, 3, 'manager');

-- KPI Group for intern developers (based on spec examples)
INSERT INTO kpi_groups (name, description, created_by) VALUES
  ('Intern Developers', 'KPIs for junior developers and interns', 1),
  ('Senior Developers', 'KPIs for experienced developers', 1),
  ('QA Engineers', 'Quality assurance metrics', 3);

-- Sample KPI definitions for intern developers
INSERT INTO kpi_definitions (
  group_id, category, metric_name, description, frequency, target_type, target_value,
  measurement_method, data_source, review_cadence, weight
) VALUES
  -- Process & time management
  (1, 'Process & time', 'Sprint commitment accuracy', 'Percentage of committed story points delivered', 'Sprint', 'percentage', '≥95%', 'Compare delivered vs committed story points', 'Jira/Sprint reports', 'End of each sprint', 8),
  (1, 'Process & time', 'Daily standup attendance', 'Consistent participation in daily standups', 'Daily', 'percentage', '≥95%', 'Track attendance over sprint period', 'Calendar/standup notes', 'Weekly', 5),
  
  -- Board hygiene
  (1, 'Board hygiene', 'Story refinement', 'Stories moved to ready status have acceptance criteria', 'Weekly', 'percentage', '≥90%', 'Review stories in ready column for AC completeness', 'Jira board audit', 'Weekly', 6),
  (1, 'Board hygiene', 'Task updates', 'Work items updated within 24 hours of progress', 'Daily', 'percentage', '≥90%', 'Check last updated timestamp vs work activity', 'Jira activity logs', 'Daily', 4),
  
  -- Planning & estimation
  (1, 'Planning & estimation', 'Estimation accuracy', 'Story point estimates vs actual time variance', 'Sprint', 'numeric', '≤1.5', 'Calculate ratio of actual vs estimated effort', 'Time tracking vs story points', 'Sprint retrospective', 7),
  (1, 'Planning & estimation', 'Task breakdown', 'Stories broken into tasks <8 hour estimates', 'Sprint', 'percentage', '≥85%', 'Review task sizing in sprint planning', 'Sprint planning notes', 'Sprint planning', 5),
  
  -- Delivery metrics
  (1, 'Delivery', 'Code review turnaround', 'Time from PR creation to merge', 'Weekly', 'string', 'Within 1 business day', 'Track PR timestamps for review completion', 'GitHub/GitLab metrics', 'Weekly', 6),
  (1, 'Delivery', 'Deployment success rate', 'Successful deployments without rollbacks', 'Sprint', 'percentage', '≥95%', 'Track deployment outcomes', 'CI/CD pipeline logs', 'End of sprint', 8);

-- Sample KPI instances (assignments)
INSERT INTO kpi_instances (definition_id, user_id, assigned_by, notes) VALUES
  (1, 4, 1, 'Focus on realistic sprint commitments'),
  (2, 4, 1, 'Essential for team communication'),
  (3, 4, 1, 'Improve story clarity skills'),
  (4, 2, 1, 'Keep team informed of progress'),
  (5, 2, 1, 'Work on estimation skills'),
  (7, 2, 1, 'Faster code review cycles needed');

-- Sample performance records
INSERT INTO performance_records (
  instance_id, value, recorded_by, period_start, period_end, notes, score
) VALUES
  (1, '92%', 1, '2025-09-01', '2025-09-14', 'Good progress, missed one small story', 85.0),
  (2, '100%', 1, '2025-09-01', '2025-09-14', 'Perfect attendance', 100.0),
  (3, '85%', 1, '2025-09-01', '2025-09-07', 'Need to improve AC writing', 75.0),
  (4, '95%', 1, '2025-09-01', '2025-09-07', 'Good communication habits', 95.0),
  (5, '1.2', 1, '2025-09-01', '2025-09-14', 'Improving estimation accuracy', 90.0),
  (6, 'Same day', 1, '2025-09-01', '2025-09-07', 'Excellent review response time', 100.0);
