# API Contracts: Performance Tracking

**Version**: 1.0.0  
**Base URL**: `/api/performance`  
**Authentication**: Required (Role-based access)

## POST /records
**Purpose**: Record KPI performance measurement (Manager only)

### Request Headers
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Request
```json
{
  "instanceId": 1,
  "value": "98%",
  "periodStart": "2025-09-09",
  "periodEnd": "2025-09-13",
  "notes": "Excellent performance this week, all tasks logged same day"
}
```

**Schema Validation**:
- `instanceId`: Required, must be valid KPI instance ID
- `value`: Required, string, must match target_type format
- `periodStart`: Required, ISO date, must align with KPI frequency
- `periodEnd`: Required, ISO date, must be after periodStart
- `notes`: Optional, string, max 1000 chars

### Response Success (201)
```json
{
  "success": true,
  "record": {
    "id": 1,
    "instanceId": 1,
    "value": "98%",
    "calculatedScore": 100,
    "periodStart": "2025-09-09",
    "periodEnd": "2025-09-13",
    "recordedBy": 1,
    "recordedAt": "2025-09-14T15:00:00Z",
    "notes": "Excellent performance this week"
  },
  "scoreCalculation": {
    "targetValue": "≥95%",
    "actualValue": "98%",
    "targetMet": true,
    "scoreReason": "Exceeded target by 3%"
  }
}
```

### Response Error (400)
```json
{
  "success": false,
  "error": "Value format doesn't match KPI target type",
  "code": "INVALID_VALUE_FORMAT",
  "expectedFormat": "percentage (e.g., 95%)",
  "receivedValue": "0.98"
}
```

## GET /user/{userId}
**Purpose**: Get performance data for specific user (Manager access to team members, Employee to self)

### Query Parameters
- `startDate`: Optional, ISO date, default 30 days ago
- `endDate`: Optional, ISO date, default today  
- `category`: Optional, filter by KPI category
- `frequency`: Optional, filter by KPI frequency

### Response Success (200)
```json
{
  "success": true,
  "user": {
    "id": 2,
    "firstName": "Alice",
    "lastName": "Johnson"
  },
  "performanceData": {
    "summary": {
      "totalKpis": 12,
      "recordedKpis": 10,
      "averageScore": 83.5,
      "weightedScore": 78.2,
      "lastUpdated": "2025-09-14T15:00:00Z"
    },
    "byCategory": {
      "Process & time": {
        "kpiCount": 2,
        "averageScore": 90.0,
        "records": [
          {
            "instanceId": 1,
            "metricName": "Daily time logging (DevOps)",
            "latestValue": "98%",
            "latestScore": 100,
            "target": "≥95%",
            "trend": "improving",
            "recordCount": 4
          }
        ]
      }
    }
  }
}
```

## GET /trends/{instanceId}
**Purpose**: Get performance trends for specific KPI instance

### Query Parameters
- `period`: Required, enum ["last30days", "last3months", "last6months", "lastyear"]
- `granularity`: Optional, enum ["daily", "weekly", "monthly"], default based on KPI frequency

### Response Success (200)
```json
{
  "success": true,
  "instance": {
    "id": 1,
    "metricName": "Daily time logging (DevOps)",
    "userName": "Alice Johnson",
    "frequency": "Weekly",
    "targetValue": "≥95%"
  },
  "trendData": [
    {
      "periodStart": "2025-08-26",
      "periodEnd": "2025-08-30",
      "value": "92%",
      "score": 75,
      "targetMet": false
    },
    {
      "periodStart": "2025-09-02",
      "periodEnd": "2025-09-06",
      "value": "96%",
      "score": 100,
      "targetMet": true
    }
  ],
  "analytics": {
    "trendDirection": "improving",
    "averageScore": 87.5,
    "bestPeriod": "2025-09-09 to 2025-09-13",
    "consistency": 0.8,
    "targetsMetPercentage": 75
  }
}
```

## GET /team/{teamId}/summary
**Purpose**: Get team performance summary (Manager only)

### Response Success (200)
```json
{
  "success": true,
  "team": {
    "id": 1,
    "name": "Frontend Development Team",
    "memberCount": 3
  },
  "performanceSummary": {
    "overallScore": 81.2,
    "topPerformers": [
      {
        "userId": 2,
        "userName": "Alice Johnson",
        "score": 88.5,
        "kpiCount": 12
      }
    ],
    "categoryBreakdown": {
      "Process & time": {
        "teamAverage": 85.0,
        "bestPerformer": "Alice Johnson",
        "needsAttention": ["Bob Smith"]
      }
    },
    "recentTrends": {
      "improving": 2,
      "declining": 1,
      "stable": 9
    }
  }
}
```

## PUT /records/{recordId}
**Purpose**: Update existing performance record (Manager only)

### Request
```json
{
  "value": "97%",
  "notes": "Updated after verification with DevOps logs"
}
```

### Response Success (200)
```json
{
  "success": true,
  "record": {
    "id": 1,
    "value": "97%",
    "calculatedScore": 100,
    "updatedAt": "2025-09-15T11:00:00Z",
    "notes": "Updated after verification with DevOps logs"
  },
  "scoreChange": {
    "oldScore": 100,
    "newScore": 100,
    "changed": false
  }
}
```

## DELETE /records/{recordId}
**Purpose**: Delete performance record (Manager only, with confirmation)

### Request
```json
{
  "reason": "Data entry error",
  "confirm": true
}
```

### Response Success (200)
```json
{
  "success": true,
  "message": "Performance record deleted",
  "deletedRecord": {
    "id": 1,
    "instanceId": 1,
    "value": "97%",
    "periodStart": "2025-09-09",
    "periodEnd": "2025-09-13"
  }
}
```

## GET /analytics/insights/{userId}
**Purpose**: Get AI-powered performance insights (Manager and Employee access)

### Response Success (200)
```json
{
  "success": true,
  "insights": {
    "strengths": [
      "Consistent high performance in Process & time category",
      "Showing steady improvement in Estimation accuracy"
    ],
    "areasForImprovement": [
      "Board hygiene KPIs need attention - 3 weeks below target",
      "Quality metrics showing declining trend"
    ],
    "recommendations": [
      "Focus on daily board updates to improve hygiene scores",
      "Consider additional testing practices to reduce defect count"
    ],
    "nextMilestones": [
      "Achieve 95% target in all Process & time KPIs",
      "Maintain estimation accuracy ±15% for 4 consecutive weeks"
    ]
  },
  "generatedAt": "2025-09-15T11:00:00Z"
}
```

---

**Score Calculation Logic**:
- **Percentage targets**: Linear calculation based on achievement vs target
- **Boolean targets**: 100 for "Yes"/true, 0 for "No"/false  
- **Numeric targets**: Scaled calculation based on range and target direction
- **String targets**: Manual scoring or predefined mapping

**Authorization Rules**:
- Managers can record/edit performance for their team members
- Employees can view their own performance data (read-only)
- Team performance summaries only accessible to team managers

**Error Codes**:
- `INVALID_VALUE_FORMAT`: Value doesn't match expected format
- `UNAUTHORIZED_INSTANCE`: Cannot access this KPI instance
- `PERIOD_OVERLAP`: Performance already recorded for this period
- `INVALID_PERIOD`: Period doesn't align with KPI frequency
