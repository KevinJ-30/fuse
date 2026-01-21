#!/bin/bash

# Simplified test to demonstrate approval flow clearly

API_URL="http://localhost:3001"
API_KEY="test"

echo "=========================================="
echo "  Testing Approval Flow"
echo "=========================================="
echo ""

# Test high-value refund that should require approval
echo "Creating a high-value refund (\$2000) that requires approval..."
RESPONSE=$(curl -s -X POST "$API_URL/api/proxy/execute" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "agentId": "billing_agent",
    "tool": "stripe_refund",
    "input": {
      "charge_id": "ch_demo_12345",
      "amount": 2000,
      "customer_id": "cus_demo_67890",
      "reason": "Customer requested full refund"
    }
  }')

echo "Response:"
echo "$RESPONSE" | jq .
echo ""

STATUS=$(echo "$RESPONSE" | jq -r '.status')
EXEC_ID=$(echo "$RESPONSE" | jq -r '.executionId // empty')
REQUEST_ID=$(echo "$RESPONSE" | jq -r '.requestId // empty')

if [ "$STATUS" = "pending_approval" ]; then
  echo "✓ Success! Execution requires approval"
  echo "  Execution ID: $EXEC_ID"
  echo "  Request ID: $REQUEST_ID"
  echo ""
  echo "Now:"
  echo "  1. Go to http://localhost:3000/approvals"
  echo "  2. You should see this \$2000 refund waiting for approval"
  echo "  3. Click on it to see details including risk score and detection flags"
  echo "  4. You can approve or deny it"
  echo ""
elif [ "$STATUS" = "executed" ]; then
  echo "⚠ Execution completed without approval (detection rules may not be working)"
  echo "  Execution ID: $EXEC_ID"
elif [ "$STATUS" = "blocked" ]; then
  echo "⚠ Execution was blocked"
  echo "  Reason: $(echo "$RESPONSE" | jq -r '.reason')"
else
  echo "✗ Unexpected status: $STATUS"
fi

echo ""
echo "You can also check the database:"
echo "  psql relay -c \"SELECT * FROM \\\"ApprovalRequest\\\" WHERE status = 'PENDING'\""
