# Quickstart Guide: KPI Tracker

**Purpose**: Validate complete user workflow from setup to analytics  
**Estimated Time**: 15-20 minutes  
**Prerequisites**: Application installed and running

## Overview
This quickstart demonstrates the complete KPI tracking workflow by simulating a real-world scenario where a manager creates KPI groups, manages a team, assigns KPIs, tracks performance, and both manager and employee view analytics.

## Test Scenario: Software Development Team

### Characters
- **Manager**: Sarah Chen (sarah.chen@company.com)
- **Employee**: Alex Rivera (alex.rivera@company.com) - Intern Developer

### KPI Group: "Intern Developers"
Based on the real KPI structure provided, focusing on key metrics for intern-level software developers.

---

## Step 1: Manager Registration and Setup

### 1.1 Register Manager Account
```
1. Launch KPI Tracker application
2. Click "Create Account"
3. Fill registration form:
   - Email: sarah.chen@company.com
   - Password: ManagerPass123!
   - First Name: Sarah
   - Last Name: Chen
   - Role: Manager
4. Click "Register"
5. Check email for verification link
6. Click verification link
7. Return to application and log in
```

**Expected Result**: Successfully logged in as Sarah Chen with manager dashboard visible.

### 1.2 Create KPI Group
```
1. Navigate to "KPI Groups" section
2. Click "Create New Group"
3. Fill group details:
   - Name: "Intern Developers"
   - Description: "Performance metrics for intern-level software developers"
4. Add KPI definitions (sample set):

   KPI 1:
   - Category: Process & time
   - Metric: Daily time logging (DevOps)
   - Description: Log all hours worked today against DevOps tasks before day end
   - Frequency: Weekly
   - Target: ≥95% days logged same-day
   - Weight: 10
   - Measurement: Days with 100% hours logged same day + working days
   - Data Source: Azure DevOps
   - Review: End of week

   KPI 2:
   - Category: Board hygiene
   - Metric: Board updated before standup (10:00)
   - Description: By 09:55 each working day, DevOps board reflects true status
   - Frequency: Daily/Sprint
   - Target: ≥95% of working days
   - Weight: 5
   - Measurement: Days where active items reflect actual status by 09:55
   - Data Source: Azure DevOps
   - Review: Daily check; sprint roll-up

   KPI 3:
   - Category: Planning & estimation
   - Metric: Estimation accuracy (Items closed this week)
   - Description: Median of |Actual−Estimate| ÷ Estimate for items closed
   - Frequency: Weekly
   - Target: ±20%
   - Weight: 5
   - Measurement: Median |Actual−Estimate| ÷ Estimate for items closed
   - Data Source: Azure DevOps
   - Review: End of week; end of sprint roll-up

5. Click "Save KPI Group"
```

**Expected Result**: KPI group "Intern Developers" created with 3 sample KPIs.

---

## Step 2: Employee Registration

### 2.1 Register Employee Account
```
1. Open new browser/incognito window or log out
2. Click "Create Account"
3. Fill registration form:
   - Email: alex.rivera@company.com
   - Password: EmployeePass123!
   - First Name: Alex
   - Last Name: Rivera
   - Role: Employee
4. Register and verify email
5. Log in as Alex Rivera
```

**Expected Result**: Successfully logged in as Alex Rivera with employee dashboard visible (empty initially).

---

## Step 3: Team Creation and Management

### 3.1 Manager Creates Team (Sarah's session)
```
1. Navigate to "Teams" section
2. Click "Create New Team"
3. Fill team details:
   - Name: "Junior Development Team"
   - Description: "Team for junior and intern developers"
4. Search and add team members:
   - Find "Alex Rivera" by email/name
   - Add to team
5. Click "Create Team"
```

**Expected Result**: Team created with Alex Rivera as member.

### 3.2 Assign KPI Group to Employee
```
1. Navigate to team member list
2. Click on "Alex Rivera"
3. Click "Assign KPI Group"
4. Select "Intern Developers" group
5. Add assignment notes: "Q4 2025 performance tracking"
6. Click "Assign"
```

**Expected Result**: All 3 KPIs from "Intern Developers" group assigned to Alex Rivera.

---

## Step 4: Performance Tracking

### 4.1 Manager Records Initial Performance (Week 1)
```
1. Navigate to "Performance Tracking"
2. Select team member "Alex Rivera"
3. View assigned KPIs
4. Record performance for each KPI:

   Daily time logging (DevOps):
   - Period: Sept 9-13, 2025
   - Value: 80%
   - Notes: "Good start, missed logging on Friday"

   Board updated before standup:
   - Period: Sept 9-13, 2025  
   - Value: 90%
   - Notes: "Missed updates on 2 days this week"

   Estimation accuracy:
   - Period: Sept 9-13, 2025
   - Value: 35%
   - Notes: "Underestimated complexity on 2 tasks"

5. Save all performance records
```

**Expected Result**: Performance data recorded with calculated scores.

### 4.2 Record Improved Performance (Week 2)
```
1. Record performance for week of Sept 16-20, 2025:

   Daily time logging (DevOps):
   - Value: 96%
   - Notes: "Much better! Only missed one entry"

   Board updated before standup:
   - Value: 100%
   - Notes: "Perfect week - all updates on time"

   Estimation accuracy:
   - Value: 18%
   - Notes: "Significant improvement in estimation"

2. Save all records
```

**Expected Result**: Improved scores showing positive trend.

---

## Step 5: Employee Dashboard Experience

### 5.1 Employee Views KPIs (Alex's session)
```
1. Log in as Alex Rivera
2. Navigate to "My KPIs" dashboard
3. Verify display shows:
   - All assigned KPIs organized by category
   - Current performance status for each KPI
   - Target values and measurement details
   - Progress indicators and latest scores
```

**Expected Result**: Clean, organized view of assigned KPIs with current performance.

### 5.2 Employee Views Performance Trends
```
1. Click on "Daily time logging" KPI
2. View performance history:
   - Week 1: 80% (below target)
   - Week 2: 96% (above target)
3. View trend chart showing improvement
4. Check other KPIs for trend analysis
```

**Expected Result**: Visual trends showing performance improvement over time.

---

## Step 6: Analytics and Reporting

### 6.1 Manager Views Team Analytics (Sarah's session)
```
1. Navigate to "Team Analytics"
2. Select "Junior Development Team"
3. View team performance summary:
   - Overall team score
   - Individual member performance
   - Category breakdown
   - Performance trends
4. Check individual member details for Alex Rivera
```

**Expected Result**: Comprehensive team analytics with drill-down capabilities.

### 6.2 Performance Insights
```
1. Navigate to "Performance Insights" for Alex Rivera
2. Review automatically generated insights:
   - Strengths identified
   - Areas for improvement
   - Recommendations
   - Next milestones
3. Verify insights match recorded performance data
```

**Expected Result**: Meaningful insights based on performance patterns.

### 6.3 Chart Visualization
```
1. View various chart types:
   - Line charts: KPI scores over time
   - Bar charts: Category performance comparison
   - Gauge charts: Progress against targets
2. Verify charts are interactive and responsive
3. Test different time period filters
```

**Expected Result**: Rich visual analytics with multiple chart types.

---

## Step 7: Advanced Features Testing

### 7.1 KPI Group Management
```
1. Manager updates KPI group:
   - Modify description
   - Adjust KPI weights
   - Add new KPI definition
2. Verify changes reflect in employee assignments
```

### 7.2 Team Management
```
1. Manager adds another employee to team
2. Assigns different KPI group
3. Compares performance across team members
```

### 7.3 Performance Record Management
```
1. Manager corrects a performance entry
2. Adds detailed notes to a record
3. Views audit trail of changes
```

---

## Success Criteria

### Functional Validation
- [✓] Manager can register, verify email, and access manager features
- [✓] Employee can register, verify email, and access employee features
- [✓] KPI groups can be created with complex, structured definitions
- [✓] Teams can be created and managed with proper member access
- [✓] KPI assignments work automatically when groups are assigned
- [✓] Performance tracking accepts various data types (percentage, boolean, numeric)
- [✓] Score calculation works correctly based on targets
- [✓] Analytics and trends display meaningful insights
- [✓] Charts and visualizations render properly
- [✓] Role-based access control enforced throughout

### Performance Validation
- [✓] UI responses under 500ms for typical operations
- [✓] Chart rendering completes within 2 seconds
- [✓] Database queries optimized for large datasets
- [✓] Application handles 50+ KPIs per user smoothly

### User Experience Validation
- [✓] Intuitive navigation between manager and employee features
- [✓] Clear visual distinction between different KPI categories
- [✓] Helpful error messages and validation feedback
- [✓] Responsive design works across different screen sizes
- [✓] Consistent styling and branding throughout

---

## Troubleshooting Common Issues

### Authentication Issues
- Verify email verification process works
- Check JWT token expiration handling
- Test password complexity validation

### Performance Tracking Issues
- Verify period calculations align with KPI frequency
- Check score calculation algorithms
- Test various data type entries

### Analytics Issues
- Verify chart data loading and rendering
- Test different time period filters
- Check trend calculation accuracy

---

**Completion Time**: Target 15-20 minutes for full workflow  
**Success Rate**: All functional validation checkpoints must pass  
**Next Steps**: Ready for production deployment if all criteria met
