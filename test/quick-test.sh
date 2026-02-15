#!/bin/bash

# Quick Test Script for EMT Scenario Trainer
# This script runs a simplified test to quickly verify the system is working

API_URL="${API_URL:-http://localhost:3000}"

echo "🧪 EMT Scenario Trainer - Quick Test"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if server is running
echo "Checking API connectivity..."
if curl -s "${API_URL}/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} API is reachable at ${API_URL}"
else
    echo -e "${RED}✗${NC} Cannot connect to API at ${API_URL}"
    echo "Please start the server with: npm run dev:backend"
    exit 1
fi

echo ""
echo "Running quick scenario test..."
echo ""

# Test 1: Create a simple cardiac scenario
echo "Test 1: Basic cardiac scenario interaction"

# Step 1: Initial greeting
RESPONSE=$(curl -s -X POST "${API_URL}/api/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hi, I am an EMT. Is the scene safe?",
    "conversation": [],
    "scenarioData": {
      "sunetId": "quick-test",
      "mainScenario": "Medical Scenario",
      "subScenario": "Cardiac Scenario"
    }
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✓${NC} Patient responds to greeting"
else
    echo -e "${RED}✗${NC} Failed to get response"
    echo "$RESPONSE"
    exit 1
fi

# Step 2: Ask chief complaint
SESSION_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['sessionId'])" 2>/dev/null)
CONVERSATION=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin)['data']['conversation']))" 2>/dev/null)

RESPONSE2=$(curl -s -X POST "${API_URL}/api/chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"What's your chief complaint?\",
    \"conversation\": ${CONVERSATION},
    \"scenarioData\": {
      \"sunetId\": \"quick-test\",
      \"mainScenario\": \"Medical Scenario\",
      \"subScenario\": \"Cardiac Scenario\"
    },
    \"sessionId\": \"${SESSION_ID}\"
  }")

if echo "$RESPONSE2" | grep -q '"success":true'; then
    echo -e "${GREEN}✓${NC} Patient describes complaint"
else
    echo -e "${RED}✗${NC} Failed to get second response"
    exit 1
fi

# Test 2: Verify scoring endpoint
echo ""
echo "Test 2: Scoring functionality"

CONVERSATION2=$(echo "$RESPONSE2" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin)['data']['conversation']))" 2>/dev/null)

SCORE_RESPONSE=$(curl -s -X POST "${API_URL}/api/score" \
  -H "Content-Type: application/json" \
  -d "{
    \"conversation\": ${CONVERSATION2},
    \"scenarioData\": {
      \"sunetId\": \"quick-test\",
      \"mainScenario\": \"Medical Scenario\",
      \"subScenario\": \"Cardiac Scenario\"
    },
    \"sessionId\": \"${SESSION_ID}\"
  }")

if echo "$SCORE_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✓${NC} Scoring endpoint working"
    SCORE=$(echo "$SCORE_RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['data'].get('score', 'N/A'))" 2>/dev/null)
    echo "   Score: $SCORE"
else
    echo -e "${RED}✗${NC} Scoring endpoint failed"
    exit 1
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}All quick tests passed!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "To run the full test suite:"
echo "  npm test"
echo ""
echo "To run individual scenarios:"
echo "  node test/test-runner.js"
