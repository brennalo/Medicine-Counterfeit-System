#!/bin/bash
# Testing Script - Medicine Counterfeit Prevention System
# Run this script to test all API endpoints

API_BASE="http://localhost:3000/api"

echo "========================================"
echo "MEDICINE COUNTERFEIT SYSTEM - API TESTS"
echo "========================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to test endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=$5
    
    echo ""
    echo "TEST: $name"
    echo "Endpoint: $method $endpoint"
    
    if [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    status=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    echo "Status: $status"
    echo "Response: $body"
    
    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAIL (Expected $expected_status, got $status)${NC}"
        ((TESTS_FAILED++))
    fi
}

# TEST 1: Hospital Login Success
test_endpoint \
    "Hospital Login Success" \
    "POST" \
    "/auth/login" \
    '{"userId":"HOSPITAL001","password":"hospital123"}' \
    "200"

# TEST 2: Invalid Credentials
test_endpoint \
    "Invalid Credentials" \
    "POST" \
    "/auth/login" \
    '{"userId":"INVALID","password":"wrongpass"}' \
    "401"

# TEST 3: Wrong Password
test_endpoint \
    "Wrong Password for Valid User" \
    "POST" \
    "/auth/login" \
    '{"userId":"HOSPITAL001","password":"wrongpassword"}' \
    "401"

# TEST 4: Missing Fields
test_endpoint \
    "Missing Required Fields" \
    "POST" \
    "/auth/login" \
    '{"userId":"","password":""}' \
    "400"

# TEST 5: Manufacturer Registration (requires hospital session)
echo ""
echo "========================================"
echo "SUMMARY"
echo "========================================"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
TOTAL=$((TESTS_PASSED + TESTS_FAILED))
SUCCESS_RATE=$((TESTS_PASSED * 100 / TOTAL))
echo "Success Rate: $SUCCESS_RATE%"
echo ""
