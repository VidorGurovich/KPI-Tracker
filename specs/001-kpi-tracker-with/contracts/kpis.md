# API Contracts: KPI Management

**Version**: 1.0.0  
**Base URL**: `/api/kpis`  
**Authentication**: Required (Role-based access)

## POST /groups
**Purpose**: Create KPI group with definitions (Manager only)

### Request Headers
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Request
```json
{
  "name": "Intern Developers",
  "description": "KPI set for intern-level software developers",
  "definitions": [
    {
      "category": "Process & time",
      "metricName": "Daily time logging (DevOps)",
      "description": "Log all hours worked today against DevOps tasks before day end; counts days with 100% same-day logs.",
      "frequency": "Weekly",
      "targetType": "percentage",
      "targetValue": "≥95%",
      "measurementMethod": "Days with 100% hours logged same day + working days",
      "dataSource": "Azure DevOps",
      "reviewCadence": "End of week",
      "weight": 10
    }
  ]
}
```

**Schema Validation**:
- `name`: Required, string, max 255 chars, unique per creator
- `description`: Optional, string, max 1000 chars
- `definitions`: Required, array, min 1 item
- Each definition must include all required fields with proper types

### Response Success (201)
```json
{
  "success": true,
  "group": {
    "id": 1,
    "name": "Intern Developers",
    "description": "KPI set for intern-level software developers",
    "definitionCount": 1,
    "createdBy": 1,
    "createdAt": "2025-09-15T10:00:00Z"
  },
  "definitions": [
    {
      "id": 1,
      "category": "Process & time",
      "metricName": "Daily time logging (DevOps)",
      "weight": 10
    }
  ]
}
```

## GET /groups
**Purpose**: Get KPI groups created by current user (Manager only)

### Response Success (200)
```json
{
  "success": true,
  "groups": [
    {
      "id": 1,
      "name": "Intern Developers",
      "description": "KPI set for intern-level software developers",
      "definitionCount": 12,
      "assignedUsers": 3,
      "isActive": true,
      "createdAt": "2025-09-15T10:00:00Z"
    }
  ]
}
```

## GET /groups/{groupId}/definitions
**Purpose**: Get detailed KPI definitions within a group

### Response Success (200)
```json
{
  "success": true,
  "group": {
    "id": 1,
    "name": "Intern Developers",
    "description": "KPI set for intern-level software developers"
  },
  "definitions": [
    {
      "id": 1,
      "category": "Process & time",
      "metricName": "Daily time logging (DevOps)",
      "description": "Log all hours worked today against DevOps tasks...",
      "frequency": "Weekly",
      "targetType": "percentage",
      "targetValue": "≥95%",
      "measurementMethod": "Days with 100% hours logged same day + working days",
      "dataSource": "Azure DevOps",
      "reviewCadence": "End of week",
      "weight": 10,
      "isActive": true
    }
  ]
}
```

## POST /assignments
**Purpose**: Assign KPI group to team member (Manager only)

### Request
```json
{
  "groupId": 1,
  "userId": 2,
  "notes": "Q4 performance tracking for Alice"
}
```

### Response Success (201)
```json
{
  "success": true,
  "message": "KPI group assigned successfully",
  "assignment": {
    "userId": 2,
    "userName": "Alice Johnson",
    "groupId": 1,
    "groupName": "Intern Developers",
    "instancesCreated": 12,
    "assignedAt": "2025-09-15T10:00:00Z"
  }
}
```

### Response Error (400)
```json
{
  "success": false,
  "error": "User is not in any of your teams",
  "code": "UNAUTHORIZED_USER_ASSIGNMENT"
}
```

## GET /assigned
**Purpose**: Get KPIs assigned to current user (Employee access)

### Response Success (200)
```json
{
  "success": true,
  "user": {
    "id": 2,
    "firstName": "Alice",
    "lastName": "Johnson"
  },
  "kpisByCategory": {
    "Process & time": [
      {
        "instanceId": 1,
        "definitionId": 1,
        "metricName": "Daily time logging (DevOps)",
        "description": "Log all hours worked today...",
        "frequency": "Weekly",
        "targetValue": "≥95%",
        "weight": 10,
        "assignedAt": "2025-09-15T10:00:00Z",
        "latestScore": 85.5,
        "lastRecorded": "2025-09-14T15:00:00Z"
      }
    ]
  },
  "summary": {
    "totalKpis": 12,
    "averageScore": 78.3,
    "lastUpdated": "2025-09-14T15:00:00Z"
  }
}
```

## GET /instances/{instanceId}/history
**Purpose**: Get performance history for specific KPI instance

### Response Success (200)
```json
{
  "success": true,
  "instance": {
    "id": 1,
    "metricName": "Daily time logging (DevOps)",
    "targetValue": "≥95%",
    "frequency": "Weekly"
  },
  "records": [
    {
      "id": 1,
      "value": "95%",
      "score": 100,
      "periodStart": "2025-09-09",
      "periodEnd": "2025-09-13",
      "recordedAt": "2025-09-14T15:00:00Z",
      "recordedBy": "Manager Name",
      "notes": "Good improvement this week"
    }
  ]
}
```

## PUT /groups/{groupId}
**Purpose**: Update KPI group (Manager only)

### Request
```json
{
  "name": "Updated Intern Developers",
  "description": "Updated description",
  "isActive": true
}
```

### Response Success (200)
```json
{
  "success": true,
  "group": {
    "id": 1,
    "name": "Updated Intern Developers",
    "description": "Updated description",
    "updatedAt": "2025-09-15T11:00:00Z"
  }
}
```

## DELETE /assignments/{instanceId}
**Purpose**: Remove KPI assignment from user (Manager only)

### Response Success (200)
```json
{
  "success": true,
  "message": "KPI assignment removed. Historical data preserved."
}
```

---

**Authorization Rules**:
- Managers can create/edit KPI groups and assignments
- Managers can only assign KPIs to their team members
- Employees can view their assigned KPIs (read-only)
- Historical performance data always preserved

**Error Codes**:
- `UNAUTHORIZED_USER_ASSIGNMENT`: Cannot assign KPIs to this user
- `GROUP_NOT_FOUND`: KPI group doesn't exist
- `INSTANCE_NOT_FOUND`: KPI instance doesn't exist
- `DUPLICATE_ASSIGNMENT`: KPI already assigned to user
