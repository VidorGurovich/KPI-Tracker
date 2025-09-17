# API Contracts: Authentication

**Version**: 1.0.0  
**Base URL**: `/api/auth`  
**Authentication**: None required (public endpoints)

## POST /register
**Purpose**: Register new user with email verification

### Request
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "role": "employee"
}
```

**Schema Validation**:
- `email`: Required, valid email format, unique
- `password`: Required, min 8 chars, must contain uppercase, lowercase, number
- `firstName`: Required, string, max 100 chars
- `lastName`: Required, string, max 100 chars  
- `role`: Required, enum ["manager", "employee", "both"]

### Response Success (201)
```json
{
  "success": true,
  "message": "Registration successful. Please check your email for verification.",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "employee",
    "emailVerified": false
  }
}
```

### Response Error (400/409)
```json
{
  "success": false,
  "error": "Email already registered",
  "code": "EMAIL_EXISTS"
}
```

## POST /login
**Purpose**: Authenticate user and return JWT token

### Request
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

### Response Success (200)
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "employee",
    "emailVerified": true
  },
  "expiresIn": "24h"
}
```

### Response Error (401)
```json
{
  "success": false,
  "error": "Invalid email or password",
  "code": "INVALID_CREDENTIALS"
}
```

## POST /verify
**Purpose**: Verify email address using verification token

### Request
```json
{
  "token": "abc123def456ghi789"
}
```

### Response Success (200)
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

### Response Error (400)
```json
{
  "success": false,
  "error": "Invalid or expired verification token",
  "code": "INVALID_TOKEN"
}
```

## POST /refresh
**Purpose**: Refresh JWT token before expiration

### Request Headers
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response Success (200)
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h"
}
```

## POST /logout
**Purpose**: Invalidate current session (client-side token removal)

### Request Headers
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response Success (200)
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

**Error Codes**:
- `EMAIL_EXISTS`: Email already registered
- `INVALID_CREDENTIALS`: Wrong email/password
- `INVALID_TOKEN`: Token expired/invalid
- `EMAIL_NOT_VERIFIED`: Account not verified
- `VALIDATION_ERROR`: Request data validation failed
