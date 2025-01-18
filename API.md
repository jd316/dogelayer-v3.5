# DogeBridge API Documentation

## Base URL

```
https://api.dogebridge.network/v1
```

## Authentication

All API endpoints require an API key to be passed in the headers:

```
Authorization: Bearer YOUR_API_KEY
```

## Endpoints

### Bridge Operations

#### Generate Deposit Address

```typescript
POST /deposit/address
Content-Type: application/json
```

Request Body:

```json
{
  "amount": "100.5",           // Amount in DOGE
  "account": "0x1234...",      // Polygon wallet address
  "email": "user@example.com"  // Optional: for notifications
}
```

Response:

```json
{
  "success": true,
  "data": {
    "depositAddress": "DRtbRTXscM1qWe1zjQSZJxEVryvYgXqkEE",
    "expiresAt": "2024-03-20T15:30:00Z",
    "minimumConfirmations": 6
  }
}
```

#### Check Transaction Status

```typescript
GET /transaction/:txId
```

Response:

```json
{
  "success": true,
  "data": {
    "status": "confirmed",  // pending | confirmed | completed | failed
    "confirmations": 3,
    "requiredConfirmations": 6,
    "amount": "100.5",
    "fee": "1.0",
    "timestamp": "2024-03-20T15:30:00Z"
  }
}
```

#### List Transactions

```typescript
GET /transactions
Query Parameters:
- address: Wallet address
- status: Transaction status
- from: Start timestamp
- to: End timestamp
- limit: Number of records (default: 10, max: 100)
- offset: Pagination offset
```

Response:

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "txId": "0x1234...",
        "type": "deposit",
        "status": "completed",
        "amount": "100.5",
        "fee": "1.0",
        "timestamp": "2024-03-20T15:30:00Z"
      }
    ],
    "pagination": {
      "total": 45,
      "limit": 10,
      "offset": 0
    }
  }
}
```

### Staking Operations

#### Get Staking Info

```typescript
GET /staking/:address
```

Response:

```json
{
  "success": true,
  "data": {
    "stakedAmount": "1000.0",
    "pendingRewards": "5.5",
    "apy": "5.00",
    "lockPeriod": "0",
    "nextRewardAt": "2024-03-21T00:00:00Z"
  }
}
```

### Lending Operations

#### Get Loan Info

```typescript
GET /lending/:address
```

Response:

```json
{
  "success": true,
  "data": {
    "loanAmount": "1000.0",
    "collateralAmount": "1500.0",
    "interestDue": "10.5",
    "collateralRatio": "150",
    "liquidationPrice": "0.66",
    "nextInterestDue": "2024-03-21T00:00:00Z"
  }
}
```

### Gas Relayer Operations

#### Estimate Relay Fee

```typescript
GET /api/gas-relayer?action=estimate
Query Parameters:
- gasLimit: number (required) - Estimated gas limit for the transaction
```

Response:

```json
{
  "fee": "1000000000000000" // Estimated fee in wei
}
```

#### Get Relayer Balance

```typescript
GET /api/gas-relayer?action=balance
Query Parameters:
- relayer: string (required) - Relayer address
```

Response:

```json
{
  "balance": "1000000000000000" // Balance in wei
}
```

#### Compensate Relayer

```typescript
POST /api/gas-relayer?action=compensate
Content-Type: application/json

Request Body:
{
  "relayer": "0x1234...",  // Relayer address
  "gasUsed": 50000         // Gas used for transaction
}
```

Response:

```json
{
  "success": true
}
```

#### Withdraw Relayer Balance

```typescript
POST /api/gas-relayer?action=withdraw
Content-Type: application/json

Request Body:
{
  "relayer": "0x1234..."  // Relayer address
}
```

Response:

```json
{
  "success": true
}
```

## WebSocket API

### Connection

```typescript
ws://api.dogebridge.network/v1/ws
```

### Subscribe to Updates

```json
{
  "op": "subscribe",
  "channel": "transactions",
  "address": "0x1234..."
}
```

### Event Types

```typescript
// Transaction Update
{
  "type": "transaction",
  "data": {
    "txId": "0x1234...",
    "status": "confirmed",
    "confirmations": 4
  }
}

// Price Update
{
  "type": "price",
  "data": {
    "doge_usd": "0.15",
    "timestamp": "2024-03-20T15:30:00Z"
  }
}
```

## Error Handling

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_AMOUNT",
    "message": "Amount must be greater than minimum deposit",
    "details": {
      "minimum": "100"
    }
  }
}
```

Common Error Codes:

- `INVALID_AMOUNT`: Invalid transaction amount
- `INSUFFICIENT_BALANCE`: Insufficient balance for operation
- `INVALID_ADDRESS`: Invalid wallet address
- `RATE_LIMITED`: Too many requests
- `UNAUTHORIZED`: Invalid or missing API key
- `SERVER_ERROR`: Internal server error

## Rate Limits

- Public endpoints: 100 requests per minute
- Authenticated endpoints: 1000 requests per minute
- WebSocket connections: 10 per IP address

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1621436800
```

### Health Check

#### Get Service Health Status

```typescript
GET /api/health
```

Response (Healthy):

```json
{
  "success": true,
  "data": {
    "healthy": true,
    "status": {
      "provider": {
        "connected": true,
        "network": "polygon",
        "chainId": 137
      },
      "gasPrice": {
        "current": "50",
        "max": "500",
        "ok": true
      },
      "contracts": {
        "gasRelayer": {
          "configured": true,
          "address": "0x1234..."
        },
        "wdoge": {
          "configured": true,
          "address": "0x5678..."
        },
        "bridge": {
          "configured": true,
          "address": "0x9abc..."
        },
        "staking": {
          "configured": true,
          "address": "0xdef0..."
        },
        "lending": {
          "configured": true,
          "address": "0x1234..."
        }
      },
      "timestamp": "2024-03-20T15:30:00Z"
    }
  }
}
```

Response (Unhealthy):

```json
{
  "success": false,
  "error": {
    "code": "HEALTH_CHECK_FAILED",
    "message": "Service is unhealthy",
    "details": {
      "status": {
        // Same structure as above
      }
    }
  }
}
```

## Rate Limits and Security

### Rate Limiting

The API implements a tiered rate limiting system:

- **Public Access**:
  - 100 requests per minute per IP
  - Basic endpoints only
  - Limited functionality

- **Authenticated Access**:
  - 1000 requests per minute per API key
  - Full access to all endpoints
  - Higher transaction limits

### IP Blocking

The system implements progressive IP blocking for rate limit violations:

- After 5 violations: 2-minute block
- After 6 violations: 4-minute block
- After 7 violations: 8-minute block
- And so on, up to a maximum of 24 hours

### Response Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1621436800
```

### Error Responses

Rate limiting errors:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests, please try again later",
    "details": {
      "retryAfter": 60
    }
  }
}
```

IP blocking errors:

```json
{
  "success": false,
  "error": {
    "code": "IP_BLOCKED",
    "message": "IP blocked until 2024-03-21T00:00:00Z: Excessive rate limit violations"
  }
}
```

## Gas Relayer API

### Estimate Relay Fee

```typescript
GET /api/gas-relayer?action=estimate
Query Parameters:
- gasLimit: number (required) - Estimated gas limit for the transaction

Response:
{
  "success": true,
  "data": {
    "fee": "1000000000000000", // Estimated fee in wei
    "gasPrice": "50000000000", // Current gas price in wei
    "multiplier": "110"        // Current fee multiplier (110 = 110%)
  }
}

Errors:
- INVALID_GAS_LIMIT: Gas limit is missing or invalid
- GAS_PRICE_UNAVAILABLE: Gas price data is temporarily unavailable
```

### Get Relayer Balance

```typescript
GET /api/gas-relayer?action=balance
Query Parameters:
- relayer: string (required) - Relayer address

Response:
{
  "success": true,
  "data": {
    "balance": "1000000000000000", // Balance in wei
    "pendingCompensation": "0",    // Pending compensation in wei
    "totalProcessed": "100"        // Total transactions processed
  }
}

Errors:
- INVALID_ADDRESS: Invalid relayer address
- RELAYER_NOT_FOUND: Relayer not registered in the system
```

### Compensate Relayer

```typescript
POST /api/gas-relayer?action=compensate
Content-Type: application/json

Request Body:
{
  "relayer": "0x1234...",  // Relayer address
  "gasUsed": 50000,        // Gas used for transaction
  "txHash": "0x5678..."    // Optional: Transaction hash for verification
}

Response:
{
  "success": true,
  "data": {
    "compensation": "1000000000000000", // Amount compensated in wei
    "newBalance": "5000000000000000"    // New total balance in wei
  }
}

Errors:
- INVALID_PARAMETERS: Missing or invalid parameters
- DAILY_LIMIT_EXCEEDED: Daily compensation limit reached
- UNAUTHORIZED: Not authorized to compensate this relayer
```

### Withdraw Relayer Balance

```typescript
POST /api/gas-relayer?action=withdraw
Content-Type: application/json

Request Body:
{
  "relayer": "0x1234...",     // Relayer address
  "amount": "1000000000000"   // Optional: Specific amount to withdraw (default: full balance)
}

Response:
{
  "success": true,
  "data": {
    "withdrawn": "1000000000000000", // Amount withdrawn in wei
    "remainingBalance": "0",         // Remaining balance in wei
    "txHash": "0x9abc..."           // Transaction hash
  }
}

Errors:
- INVALID_ADDRESS: Invalid relayer address
- INSUFFICIENT_BALANCE: Insufficient balance for withdrawal
- CONTRACT_ERROR: Smart contract interaction failed
```

### Common Error Codes

```typescript
{
  "success": false,
  "error": {
    "code": string,    // Error code
    "message": string, // Human-readable message
    "details"?: any    // Optional additional details
  }
}
```

Common error codes:

- `RATE_LIMITED`: Too many requests
- `IP_BLOCKED`: IP address is blocked
- `INVALID_PARAMETERS`: Missing or invalid parameters
- `UNAUTHORIZED`: Invalid or missing API key
- `CONTRACT_ERROR`: Smart contract interaction failed
- `DAILY_LIMIT_EXCEEDED`: Daily processing limit exceeded
- `SYSTEM_PAUSED`: System is temporarily paused
- `GAS_PRICE_ERROR`: Gas price related error
- `VALIDATION_ERROR`: Input validation failed

### Health Check Response

```typescript
GET /api/health

Response (Healthy):
{
  "success": true,
  "data": {
    "healthy": true,
    "status": {
      "provider": {
        "connected": true,
        "network": "polygon",
        "chainId": 137
      },
      "gasPrice": {
        "current": "50",
        "max": "500",
        "ok": true,
        "lastUpdate": "2024-03-20T15:30:00Z"
      },
      "rateLimit": {
        "violations": 0,
        "blockedIPs": 0,
        "lastReset": "2024-03-20T15:00:00Z"
      },
      "contracts": {
        "gasRelayer": {
          "configured": true,
          "address": "0x1234...",
          "paused": false,
          "dailyLimit": {
            "used": "100000000000000",
            "remaining": "900000000000000",
            "resetsIn": 14400 // seconds
          }
        }
      }
    }
  }
}
```
