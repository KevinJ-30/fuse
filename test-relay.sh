#!/bin/bash

# Test script for Relay - Creates sample executions to populate the dashboard
# This demonstrates the Detection, Breaker, Policy, and Rollback features

set -e

API_URL="http://localhost:3001"
API_KEY="test-api-key"

echo "=========================================="
echo "  Testing Relay Safety Layer"
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Normal execution (should succeed)
echo -e "${YELLOW}Test 1: Normal Email Send${NC}"
echo "Sending a normal email..."
RESPONSE=$(curl -s -X POST "$API_URL/api/proxy/execute" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "agentId": "sales_bot",
    "tool": "send_email",
    "input": {
      "to": "customer@example.com",
      "subject": "Thank you for your purchase",
      "body": "We appreciate your business!"
    }
  }')

STATUS=$(echo $RESPONSE | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
EXEC_ID=$(echo $RESPONSE | grep -o '"executionId":"[^"]*"' | cut -d'"' -f4)

if [ "$STATUS" = "executed" ]; then
  echo -e "${GREEN}✓ Email sent successfully${NC}"
  echo "  Execution ID: $EXEC_ID"
else
  echo -e "${RED}✗ Failed: $RESPONSE${NC}"
fi
echo ""

# Test 2: High-value refund (should trigger approval)
echo -e "${YELLOW}Test 2: High-Value Refund (Approval Required)${NC}"
echo "Attempting a \$1500 refund..."
RESPONSE=$(curl -s -X POST "$API_URL/api/proxy/execute" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "agentId": "billing_bot",
    "tool": "stripe_refund",
    "input": {
      "charge_id": "ch_test123",
      "amount": 1500,
      "reason": "Customer request"
    }
  }')

STATUS=$(echo $RESPONSE | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
REQUEST_ID=$(echo $RESPONSE | grep -o '"requestId":"[^"]*"' | cut -d'"' -f4)

if [ "$STATUS" = "pending_approval" ]; then
  echo -e "${YELLOW}⚠ Execution requires approval (high-value refund detected)${NC}"
  echo "  Request ID: $REQUEST_ID"
  echo "  Go to the Approval Queue in the dashboard to approve/deny"
else
  echo -e "${RED}✗ Unexpected status: $STATUS${NC}"
fi
echo ""

# Test 3: Rapid-fire emails (rate limit test)
echo -e "${YELLOW}Test 3: Rate Limit Test${NC}"
echo "Sending 10 emails rapidly..."
SUCCESS_COUNT=0
BLOCKED_COUNT=0

for i in {1..10}; do
  RESPONSE=$(curl -s -X POST "$API_URL/api/proxy/execute" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d "{
      \"agentId\": \"marketing_bot\",
      \"tool\": \"send_email\",
      \"input\": {
        \"to\": \"user${i}@example.com\",
        \"subject\": \"Newsletter #${i}\",
        \"body\": \"Marketing content\"
      }
    }")

  STATUS=$(echo $RESPONSE | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

  if [ "$STATUS" = "executed" ]; then
    ((SUCCESS_COUNT++))
  else
    ((BLOCKED_COUNT++))
  fi

  sleep 0.1
done

echo -e "${GREEN}✓ Sent: $SUCCESS_COUNT emails${NC}"
if [ $BLOCKED_COUNT -gt 0 ]; then
  echo -e "${YELLOW}⚠ Blocked: $BLOCKED_COUNT emails (rate limit triggered)${NC}"
fi
echo ""

# Test 4: Suspicious pattern detection
echo -e "${YELLOW}Test 4: Pattern Detection (Unfilled Template)${NC}"
echo "Sending email with unfilled template variables..."
RESPONSE=$(curl -s -X POST "$API_URL/api/proxy/execute" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "agentId": "support_bot",
    "tool": "send_email",
    "input": {
      "to": "customer@example.com",
      "subject": "Hello {CUSTOMER_NAME}",
      "body": "Your order {ORDER_ID} will arrive on {DELIVERY_DATE}"
    }
  }')

STATUS=$(echo $RESPONSE | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$STATUS" = "pending_approval" ] || [ "$STATUS" = "blocked" ]; then
  echo -e "${YELLOW}⚠ Detected unfilled template variables${NC}"
  echo "  Status: $STATUS"
else
  echo -e "${RED}✗ Pattern detection may not be working${NC}"
fi
echo ""

# Test 5: Create a breaker
echo -e "${YELLOW}Test 5: Emergency Stop (Breaker)${NC}"
echo "Creating a breaker for support_bot..."
RESPONSE=$(curl -s -X POST "$API_URL/api/breakers" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "scope": "AGENT",
    "target": "support_bot",
    "reason": "Testing emergency stop functionality"
  }')

BREAKER_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ ! -z "$BREAKER_ID" ]; then
  echo -e "${GREEN}✓ Breaker created${NC}"
  echo "  Breaker ID: $BREAKER_ID"

  # Test that breaker blocks
  echo "  Testing if breaker blocks execution..."
  RESPONSE=$(curl -s -X POST "$API_URL/api/proxy/execute" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d '{
      "agentId": "support_bot",
      "tool": "send_email",
      "input": {
        "to": "test@example.com",
        "subject": "Test",
        "body": "This should be blocked"
      }
    }')

  STATUS=$(echo $RESPONSE | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

  if [ "$STATUS" = "blocked" ]; then
    echo -e "${GREEN}  ✓ Breaker successfully blocked execution${NC}"
  else
    echo -e "${RED}  ✗ Breaker did not block execution${NC}"
  fi
else
  echo -e "${RED}✗ Failed to create breaker${NC}"
fi
echo ""

# Summary
echo "=========================================="
echo -e "${GREEN}Testing Complete!${NC}"
echo "=========================================="
echo ""
echo "Check your dashboard at: http://localhost:3000"
echo ""
echo "You should see:"
echo "  • Execution statistics in the Dashboard"
echo "  • Pending approvals in the Approval Queue"
echo "  • Active breaker in Emergency Stops"
echo "  • Execution graph showing relationships"
echo ""
echo "Next steps:"
echo "  1. Go to Dashboard to see overall metrics"
echo "  2. Check Approval Queue to approve/deny pending requests"
echo "  3. View Emergency Stops to see the active breaker"
echo "  4. Try the Rollback feature on a completed execution"
echo ""
