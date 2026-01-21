# Relay Quick Start Guide

## Step 1: Start the Services

### 1.1 Start Database & Redis
```bash
cd /Users/kevinjacob/fuse
docker-compose up -d
```

This starts PostgreSQL and Redis in the background.

### 1.2 Setup Database
```bash
cd packages/api
npx prisma migrate dev
npx prisma db seed
cd ../..
```

This creates the database schema and seeds it with 10 default detection rules.

### 1.3 Start the Application
```bash
# From the root directory
npm run dev
```

This starts:
- **API Server**: http://localhost:3001
- **Web Dashboard**: http://localhost:5173

## Step 2: Test the Features

### Option A: Using the Web Dashboard (Easiest)

1. **Open the Dashboard**
   ```
   http://localhost:5173
   ```

2. **View Dashboard Stats**
   - You'll see metrics: executions, approval rate, active breakers, rollbacks
   - Detection layer statistics
   - Risk distribution

3. **Create a Circuit Breaker**
   - Navigate to "Emergency Stops" page
   - Click "New Breaker"
   - Select scope: GLOBAL, AGENT, or TOOL
   - Add a reason: "Testing emergency stop"
   - Click "Create"

4. **Manage Policies**
   - Navigate to "Policies" page
   - Click "New Policy"
   - Example policy:
     - Name: "High-value payments"
     - Tool: "stripe_charge"
     - Condition: "args.amount GREATER_THAN 1000"
     - Action: "REQUIRE_APPROVAL"
     - Priority: 1
   - Click "Create"

5. **View Approval Queue**
   - Navigate to "Approval Queue"
   - Here you'll see pending approval requests
   - Can approve, deny, or modify inputs

6. **Test Rollbacks**
   - Navigate to "Rollbacks"
   - Click "New Rollback"
   - Enter an execution ID (you'll need to create one first - see API testing below)
   - Preview blast radius
   - Execute rollback

### Option B: Using the API (More Control)

#### Test 1: Execute a Tool Call
```bash
# Simple execution
curl -X POST http://localhost:3001/api/proxy/execute \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-key" \
  -d '{
    "agentId": "test-agent",
    "tool": "send_email",
    "input": {
      "to": "user@example.com",
      "subject": "Test Email",
      "body": "This is a test"
    }
  }'
```

**Expected Response:**
```json
{
  "status": "executed",
  "executionId": "exec_xxx...",
  "output": { ... }
}
```

#### Test 2: Trigger a Rule Violation
```bash
# This should trigger the "High-value database deletion" rule
curl -X POST http://localhost:3001/api/proxy/execute \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-key" \
  -d '{
    "agentId": "test-agent",
    "tool": "delete_record",
    "input": {
      "table": "users",
      "id": "user_12345",
      "recordCount": 150
    }
  }'
```

**Expected Response:**
```json
{
  "status": "pending_approval",
  "executionId": "exec_xxx...",
  "requestId": "req_xxx..."
}
```

#### Test 3: Create a Circuit Breaker
```bash
curl -X POST http://localhost:3001/api/breakers \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-key" \
  -d '{
    "scope": "TOOL",
    "tool": "send_email",
    "reason": "Suspicious email activity detected"
  }'
```

#### Test 4: Try Execution with Active Breaker
```bash
# This should be blocked
curl -X POST http://localhost:3001/api/proxy/execute \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-key" \
  -d '{
    "agentId": "test-agent",
    "tool": "send_email",
    "input": {
      "to": "test@example.com",
      "subject": "Test",
      "body": "Should be blocked"
    }
  }'
```

**Expected Response:**
```json
{
  "status": "blocked",
  "reason": "Circuit breaker active: Suspicious email activity detected"
}
```

#### Test 5: Approve a Pending Request
```bash
# First, get the approval request ID from Test 2
# Then approve it
curl -X POST http://localhost:3001/api/approvals/{REQUEST_ID}/approve \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-key" \
  -d '{
    "reviewedBy": "admin",
    "comments": "Reviewed and approved"
  }'
```

#### Test 6: Preview Blast Radius
```bash
# Use an execution ID from previous tests
curl -X POST http://localhost:3001/api/rollbacks/preview \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-key" \
  -d '{
    "executionId": "exec_xxx..."
  }'
```

**Expected Response:**
```json
{
  "blastRadius": {
    "total": 1,
    "maxDepth": 0,
    "timeSpan": { ... },
    "summary": { ... }
  },
  "validation": {
    "isSafe": true,
    "warnings": [],
    "recommendations": []
  }
}
```

#### Test 7: Execute a Rollback
```bash
curl -X POST http://localhost:3001/api/rollbacks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-key" \
  -d '{
    "executionId": "exec_xxx...",
    "strategy": "SINGLE",
    "dryRun": true,
    "reviewedBy": "admin",
    "reason": "Testing rollback"
  }'
```

### Option C: Using the SDK (Production-like)

#### Install SDK in a Test Project
```bash
mkdir relay-test && cd relay-test
npm init -y
npm install typescript ts-node @types/node --save-dev
```

#### Create a Test Script
Create `test.ts`:
```typescript
import { RelayClient } from '../packages/sdk/src/client';

async function test() {
  const client = new RelayClient({
    baseUrl: 'http://localhost:3001',
    apiKey: 'test-key',
    agentId: 'test-agent',
    autoChain: true,
  });

  console.log('🧪 Test 1: Simple Execution');
  try {
    const result = await client.execute('send_email', {
      to: 'user@example.com',
      subject: 'Hello',
      body: 'Test email',
    });
    console.log('✅ Success:', result);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n🧪 Test 2: High-risk Operation (Should Need Approval)');
  try {
    const result = await client.execute('stripe_charge', {
      amount: 5000, // $50
      customer: 'cus_test',
    });
    console.log('✅ Success:', result);
  } catch (error) {
    console.log('⏳ Needs approval:', error.message);

    // Auto-wait for approval
    if (error.executionId) {
      console.log('⏳ Waiting for approval...');
      const approved = await client.waitForApproval(error.executionId);
      console.log('✅ Approved:', approved);
    }
  }

  console.log('\n🧪 Test 3: Auto-wait for Approval');
  try {
    const result = await client.executeAndWait('delete_record', {
      table: 'users',
      id: 'user_123',
      recordCount: 100,
    });
    console.log('✅ Success:', result);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n🧪 Test 4: Check Breaker Status');
  const hasBreaker = await client.checkBreaker('TOOL', 'send_email');
  console.log('Breaker active:', hasBreaker);

  console.log('\n🧪 Test 5: Get Execution History');
  const history = await client.getExecutionHistory(5);
  console.log('Recent executions:', history.length);
}

test().catch(console.error);
```

#### Run the Test
```bash
npx ts-node test.ts
```

## Step 3: Test Specific Features

### Test Circuit Breakers

1. **Create Global Breaker**
   ```bash
   curl -X POST http://localhost:3001/api/breakers \
     -H "Content-Type: application/json" \
     -H "X-API-Key: test-key" \
     -d '{"scope":"GLOBAL","reason":"Emergency maintenance"}'
   ```

2. **Try Any Execution** (should be blocked)
   ```bash
   curl -X POST http://localhost:3001/api/proxy/execute \
     -H "Content-Type: application/json" \
     -H "X-API-Key: test-key" \
     -d '{"agentId":"test-agent","tool":"any_tool","input":{}}'
   ```

3. **Deactivate Breaker** (via Dashboard or API)
   ```bash
   curl -X PATCH http://localhost:3001/api/breakers/{BREAKER_ID}/toggle \
     -H "X-API-Key: test-key"
   ```

### Test Detection Rules

The system comes with 10 pre-seeded rules. Test them:

1. **Rate Limit** - Make 10+ rapid requests
2. **High-value Deletion** - Delete with recordCount > 100
3. **External Email** - Send email to non-company domain
4. **Large Refund** - Refund > $500
5. **PII Detection** - Include SSN/credit card in input
6. **Off-hours Execution** - Run on weekend/night
7. **High-value Payment** - Payment > $1000
8. **Bulk Operations** - Batch size > 50
9. **Dangerous Commands** - Use `rm -rf` or `DROP TABLE`
10. **Protected Resources** - Access production resources

### Test Rollbacks

1. **Create Chained Executions**
   ```bash
   # Execution 1 (parent)
   curl -X POST http://localhost:3001/api/proxy/execute \
     -H "Content-Type: application/json" \
     -H "X-API-Key: test-key" \
     -d '{
       "agentId": "test-agent",
       "tool": "create_record",
       "input": {"table": "users", "data": {"name": "Test"}}
     }'
   # Save the executionId as PARENT_ID

   # Execution 2 (child)
   curl -X POST http://localhost:3001/api/proxy/execute \
     -H "Content-Type: application/json" \
     -H "X-API-Key: test-key" \
     -d '{
       "agentId": "test-agent",
       "tool": "send_email",
       "input": {"to": "user@example.com", "subject": "Welcome"},
       "parentId": "PARENT_ID"
     }'
   ```

2. **Preview Blast Radius**
   ```bash
   curl -X POST http://localhost:3001/api/rollbacks/preview \
     -H "Content-Type: application/json" \
     -H "X-API-Key: test-key" \
     -d '{"executionId": "PARENT_ID"}'
   ```

3. **Execute Rollback**
   ```bash
   curl -X POST http://localhost:3001/api/rollbacks \
     -H "Content-Type: application/json" \
     -H "X-API-Key: test-key" \
     -d '{
       "executionId": "PARENT_ID",
       "strategy": "TREE",
       "dryRun": false,
       "reason": "Testing tree rollback"
     }'
   ```

## Step 4: Monitor in Real-Time

1. **Open Dashboard** - http://localhost:5173
2. **Open Browser Console** - See Socket.io events
3. **Make API Calls** - Watch dashboard update in real-time
4. **Check Logs** - API logs in terminal show all operations

## Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker ps

# Restart Docker services
docker-compose down
docker-compose up -d

# Reset database
cd packages/api
npx prisma migrate reset
```

### Port Conflicts
```bash
# Check what's using the ports
lsof -i :3001  # API
lsof -i :5173  # Web
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis

# Kill processes if needed
kill -9 <PID>
```

### API Key Issues
The default API key is `test-key`. If you want to change it:
1. Edit `packages/api/.env`
2. Set `API_KEY=your-key`
3. Restart API server

## Next Steps

1. ✅ Test all features using this guide
2. 📝 Review [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) for architecture details
3. 🔧 Customize detection rules in the database
4. 🎨 Modify UI components as needed
5. 🚀 Deploy to production (see README.md)

## Quick Reference

- **API**: http://localhost:3001
- **Dashboard**: http://localhost:5173
- **API Docs**: See README.md
- **Logs**: Check terminal running `npm run dev`
- **Database**: `npx prisma studio` (opens DB viewer)
