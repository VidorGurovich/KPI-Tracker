# API Contracts: Teams Management

**Version**: 1.0.0  
**Base URL**: `/api/teams`  
**Authentication**: Required (Manager role)

## POST /
**Purpose**: Create new team with selected employees

### Request Headers
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Request
```json
{
  "name": "Frontend Development Team",
  "description": "Team responsible for UI/UX development",
  "memberIds": [2, 3, 4]
}
```

**Schema Validation**:
- `name`: Required, string, max 255 chars, unique per manager
- `description`: Optional, string, max 1000 chars
- `memberIds`: Required, array of user IDs, must be registered employees

### Response Success (201)
```json
{
  "success": true,
  "team": {
    "id": 1,
    "name": "Frontend Development Team",
    "description": "Team responsible for UI/UX development",
    "managerId": 1,
    "memberCount": 3,
    "createdAt": "2025-09-15T10:00:00Z"
  }
}
```

### Response Error (400)
```json
{
  "success": false,
  "error": "Some users are not registered employees",
  "code": "INVALID_MEMBERS",
  "invalidIds": [5, 6]
}
```

## GET /managed
**Purpose**: Get all teams managed by current user

### Request Headers
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response Success (200)
```json
{
  "success": true,
  "teams": [
    {
      "id": 1,
      "name": "Frontend Development Team",
      "description": "Team responsible for UI/UX development",
      "memberCount": 3,
      "activeKpiGroups": 2,
      "createdAt": "2025-09-15T10:00:00Z"
    }
  ]
}
```

## GET /{teamId}/members
**Purpose**: Get detailed team member information

### Request Headers
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response Success (200)
```json
{
  "success": true,
  "team": {
    "id": 1,
    "name": "Frontend Development Team",
    "managerId": 1
  },
  "members": [
    {
      "id": 2,
      "firstName": "Alice",
      "lastName": "Johnson",
      "email": "alice@example.com",
      "joinedAt": "2025-09-15T10:00:00Z",
      "activeKpis": 8,
      "lastPerformanceUpdate": "2025-09-14T15:30:00Z"
    }
  ]
}
```

### Response Error (403)
```json
{
  "success": false,
  "error": "Not authorized to view this team",
  "code": "UNAUTHORIZED_TEAM"
}
```

## POST /{teamId}/members
**Purpose**: Add new members to existing team

### Request
```json
{
  "memberIds": [5, 6]
}
```

### Response Success (200)
```json
{
  "success": true,
  "message": "2 members added successfully",
  "addedMembers": [
    {
      "id": 5,
      "firstName": "Bob",
      "lastName": "Smith",
      "email": "bob@example.com"
    }
  ]
}
```

## DELETE /{teamId}/members/{userId}
**Purpose**: Remove member from team

### Response Success (200)
```json
{
  "success": true,
  "message": "Member removed from team",
  "removedMember": {
    "id": 5,
    "firstName": "Bob",
    "lastName": "Smith"
  }
}
```

## PUT /{teamId}
**Purpose**: Update team information

### Request
```json
{
  "name": "Full-Stack Development Team",
  "description": "Updated team description"
}
```

### Response Success (200)
```json
{
  "success": true,
  "team": {
    "id": 1,
    "name": "Full-Stack Development Team",
    "description": "Updated team description",
    "updatedAt": "2025-09-15T11:00:00Z"
  }
}
```

## DELETE /{teamId}
**Purpose**: Delete team (with confirmation)

### Request
```json
{
  "confirm": true
}
```

### Response Success (200)
```json
{
  "success": true,
  "message": "Team deleted successfully. KPI assignments preserved."
}
```

---

**Authorization Rules**:
- Only managers can create/manage teams
- Managers can only manage their own teams
- Team members can view their team information (read-only)

**Error Codes**:
- `UNAUTHORIZED_TEAM`: Not authorized for this team
- `INVALID_MEMBERS`: Non-existent or invalid member IDs
- `TEAM_NOT_FOUND`: Team doesn't exist
- `DUPLICATE_MEMBER`: Member already in team
