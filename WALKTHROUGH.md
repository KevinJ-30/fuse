# Relay Testing Walkthrough

## What Just Happened?

The test script populated your system with sample data to demonstrate all the key features:

### 1. Dashboard (http://localhost:3000)
You should now see:
- **Execution count**: ~12-15 total executions
- **Active Breakers**: 1 (for support_bot)
- **Pending Approvals**: 2 (high-value refund + template detection)
- **Detection Layer Stats**: Rule violations and anomaly detections

### 2. Approval Queue (`/approvals`)
Two items are waiting for review:

**Item 1: High-Value Refund**
- Agent: billing_bot
- Tool: stripe_refund
- Amount: $1,500
- Why it needs approval: Exceeds the $1,000 threshold rule
- **Action**: You can approve or deny this. Try editing the amount before approving!

**Item 2: Template Variables Detected**
- Agent: support_bot
- Tool: send_email
- Issue: Email contains `{CUSTOMER_NAME}`, `{ORDER_ID}` - unfilled template variables
- Why it needs approval: Pattern matching rule detected potential template errors
- **Action**: Deny this to prevent sending a broken email

### 3. Emergency Stops (`/breakers`)
One active breaker:
- **Scope**: AGENT
- **Target**: support_bot
- **Status**: ACTIVE
- **Effect**: All actions from support_bot are currently blocked
- **Action**: Try toggling it off and sending another request from support_bot

### 4. Execution Graph (`/executions`)
Shows all executions in a timeline:
- Green dots: Successfully executed
- Yellow dots: Awaiting approval
- Red dots: Blocked by breaker
- Click any execution to see details and initiate rollback

### 5. Policies (`/policies`)
Pre-seeded rules from the database:
- Rate limiting (100 emails/hour)
- Refund threshold ($1,000)
- Pattern detection (templates, SSNs, credit cards)
- Business hours restrictions
- Protected file detection

---

## Try These Scenarios

### Scenario A: Approve a High-Value Transaction
1. Go to **Approval Queue**
2. Click on the $1,500 refund
3. Review the detection flags
4. Click **Approve** → Execution will complete
5. Go to **Dashboard** → See the approval rate update

### Scenario B: Test Emergency Stop
1. Go to **Emergency Stops**
2. Toggle OFF the support_bot breaker
3. Run this command:
   ```bash
   curl -X POST "http://localhost:3001/api/proxy/execute" \
     -H "Content-Type: application/json" \
     -H "X-API-Key: test" \
     -d '{
       "agentId": "support_bot",
       "tool": "send_email",
       "input": {
         "to": "test@example.com",
         "subject": "Test after breaker removal",
         "body": "This should work now"
       }
     }'
   ```
4. It should succeed now
5. Toggle breaker back ON and try again → should be blocked

### Scenario C: Rollback an Execution
1. Go to **Execution Graph**
2. Find a completed email execution
3. Click on it → See details
4. Click **Rollback** button
5. View the **Blast Radius** (affected executions)
6. Review **Compensation Actions**:
   - For emails: Suggested action is to send correction email
   - For refunds: Auto-reverse with new charge
   - For database writes: Restore previous state
7. Select compensations to execute
8. Click **Execute Rollback**

### Scenario D: Create a Custom Policy
1. Go to **Policies**
2. Click **Create Policy**
3. Example policy:
   - Name: "Block large charges"
   - Tool: stripe_charge
   - Condition: `input.amount > 500`
   - Action: REQUIRE_APPROVAL
4. Test it with:
   ```bash
   curl -X POST "http://localhost:3001/api/proxy/execute" \
     -H "Content-Type: application/json" \
     -H "X-API-Key: test" \
     -d '{
       "agentId": "billing_bot",
       "tool": "stripe_charge",
       "input": {
         "customer_id": "cus_123",
         "amount": 750,
         "description": "Large purchase"
       }
     }'
   ```
5. Should appear in Approval Queue

### Scenario E: Global Emergency Stop
1. Go to **Emergency Stops**
2. Click **Create Breaker**
3. Set:
   - Scope: GLOBAL
   - Reason: "System-wide maintenance"
4. **WARNING**: This blocks ALL agents
5. Try any execution → should be blocked
6. Remove breaker when done

---

## Using the SDK

Instead of curl, you can use the TypeScript SDK:

```typescript
import { RelayClient } from '@relay/sdk';

const client = new RelayClient({
  baseUrl: 'http://localhost:3001',
  apiKey: 'test-api-key',
  agentId: 'my_agent',
});

// Execute a tool
const result = await client.execute('send_email', {
  to: 'user@example.com',
  subject: 'Hello',
  body: 'Test email',
});

// If it requires approval
if (result.status === 'pending_approval') {
  console.log('Waiting for approval:', result.requestId);

  // Poll for approval
  const finalResult = await client.waitForApproval(result.executionId, {
    pollInterval: 2000,
    timeout: 60000,
    onStatusChange: (status) => console.log('Status:', status),
  });
}
```

---

## API Endpoints

All endpoints require `X-API-Key` header.

### Proxy
- `POST /api/proxy/execute` - Execute a tool through the safety layer

### Breakers
- `GET /api/breakers` - List all breakers
- `POST /api/breakers` - Create breaker
- `PATCH /api/breakers/:id` - Toggle breaker
- `DELETE /api/breakers/:id` - Delete breaker

### Policies
- `GET /api/policies` - List all policies
- `POST /api/policies` - Create policy
- `PUT /api/policies/:id` - Update policy
- `DELETE /api/policies/:id` - Delete policy

### Approvals
- `GET /api/approvals` - List pending approvals
- `GET /api/approvals/:id` - Get approval details
- `POST /api/approvals/:id/approve` - Approve execution
- `POST /api/approvals/:id/deny` - Deny execution

### Executions
- `GET /api/executions` - List executions
- `GET /api/executions/:id` - Get execution details
- `GET /api/executions/:id/tree` - Get execution tree

### Rollbacks
- `GET /api/rollbacks` - List rollback history
- `POST /api/rollbacks/initiate` - Initiate rollback
- `POST /api/rollbacks/:id/execute` - Execute rollback
- `GET /api/rollbacks/:id` - Get rollback details

### Analytics
- `GET /api/analytics/dashboard?timeRange=24h` - Dashboard stats

---

## What to Look For

### Detection Layer Working
- High-risk scores (>0.6) trigger approvals
- Pattern matching catches template variables, SSNs, credit cards
- Rate limits prevent spam
- Business hours rules enforce time restrictions

### Circuit Breakers
- GLOBAL scope blocks everything
- AGENT scope blocks specific agent
- TOOL scope blocks specific tool across all agents
- Instant blocking (<10ms overhead)

### Approval Queue
- Risk score displayed with context
- Detection flags explain why it needs review
- Can edit input before approving
- Deny reason is logged

### Rollbacks
- Blast radius shows all affected executions (descendants)
- Compensation strategies are tool-specific:
  - AUTO_REVERSE: Automated undo
  - SUGGESTED: Recommended action (needs confirmation)
  - MANUAL_REQUIRED: Human intervention needed
  - NOT_REVERSIBLE: Cannot be undone
- Executions are marked as ROLLED_BACK

---

## Troubleshooting

**Dashboard is empty after running test script:**
- Check API server is running: `ps aux | grep tsx`
- Check for errors: `tail -f packages/api/*.log`
- Verify database: `psql relay -c "SELECT COUNT(*) FROM \"Execution\""`

**API returns 401:**
- Make sure to include `X-API-Key` header
- Any non-empty string works for MVP

**Approval not appearing:**
- Check if rule is enabled in Policies page
- Check risk score calculation (should be >0.3 for approval)
- Check browser console for errors

**Breaker not blocking:**
- Verify breaker status is ACTIVE
- Check scope and target match correctly
- Check API logs for breaker evaluation

---

## Next Steps

1. **Explore the UI**: Click through all pages and see how data flows
2. **Test Rollbacks**: Try rolling back an email execution
3. **Create Policies**: Add your own detection rules
4. **Integrate SDK**: Build an agent that uses the SDK
5. **Monitor Real Agents**: Point your actual AI agents to Relay

Enjoy exploring Relay!
