# Test Suite Summary

## 📋 Overview

Complete automated testing suite for the EMT Scenario Trainer chatbot.

**Status**: ✅ Ready to use  
**Total Test Scenarios**: 5  
**Estimated Run Time**: 5-10 minutes  

---

## 🚀 Quick Commands

```bash
# Quick sanity check (30 seconds)
./test/quick-test.sh

# Full test suite (5-10 minutes)
npm test

# Manual example test
node test/example-manual-test.js
```

---

## 📁 Test Files Created

### Core Test Infrastructure

1. **`test/test-runner.js`** (8.2 KB)
   - Main test execution engine
   - Runs all test scenarios
   - Validates responses and scoring
   - Generates detailed reports with pass/fail status

2. **`test/quick-test.sh`** (3.5 KB)
   - Fast sanity check script
   - Verifies API connectivity
   - Tests basic scenario interaction
   - Validates scoring endpoint

3. **`test/example-manual-test.js`** (3.6 KB)
   - Example of manual testing
   - Step-by-step scenario execution
   - Useful for debugging

### Test Scenarios

4. **`test/scenarios/cardiac-perfect.js`** (2.9 KB)
   - **Scenario**: Cardiac arrest with perfect protocol
   - **Expected Score**: 90-100%
   - **Tests**: Scene safety, OPQRST, SAMPLE, interventions, transport
   - **Purpose**: Validates high scores for perfect execution

5. **`test/scenarios/respiratory-common-mistakes.js`** (2.2 KB)
   - **Scenario**: Respiratory distress with common errors
   - **Expected Score**: 60-75%
   - **Tests**: Incomplete assessment, delayed interventions
   - **Purpose**: Validates reasonable scores for common mistakes

6. **`test/scenarios/trauma-critical-errors.js`** (1.9 KB)
   - **Scenario**: MVC trauma with critical errors
   - **Expected Score**: <60% (FAIL)
   - **Tests**: No scene safety, no C-spine, wrong order
   - **Purpose**: Validates failure for dangerous mistakes

7. **`test/scenarios/neurological-good.js`** (2.5 KB)
   - **Scenario**: Neurological emergency with good performance
   - **Expected Score**: 80-90%
   - **Tests**: Stroke assessment, proper neuro checks
   - **Purpose**: Validates good but not perfect performance

8. **`test/scenarios/metabolic-edge-case.js`** (2.3 KB)
   - **Scenario**: Metabolic emergency with unusual inputs
   - **Expected Score**: 75-85%
   - **Tests**: Short responses, clarifications, non-standard order
   - **Purpose**: Validates system robustness

### Documentation

9. **`test/README.md`** (6.9 KB)
   - Comprehensive test suite documentation
   - How to create new tests
   - Troubleshooting guide

10. **`docs/TESTING_GUIDE.md`** (11.2 KB)
    - Complete testing guide
    - Manual testing instructions
    - Best practices
    - Pre-deployment checklist

---

## 🎯 Test Coverage

### Scenarios Covered

| Scenario Type | Test Name | Coverage |
|--------------|-----------|----------|
| Cardiac | Perfect Execution | ✅ Complete |
| Respiratory | Common Mistakes | ✅ Complete |
| Trauma | Critical Errors | ✅ Complete |
| Neurological | Good Performance | ✅ Complete |
| Metabolic | Edge Cases | ✅ Complete |

### Skills Tested

- ✅ Scene safety assessment
- ✅ Chief complaint identification
- ✅ OPQRST questioning (all 6 elements)
- ✅ SAMPLE history (all elements)
- ✅ Vital signs assessment
- ✅ Appropriate interventions
- ✅ Patient reassurance
- ✅ Transport decisions
- ✅ Critical error detection
- ✅ Edge case handling

### System Components Tested

- ✅ API connectivity
- ✅ Chat endpoint (`/api/chat`)
- ✅ Scoring endpoint (`/api/score`)
- ✅ Session management
- ✅ Conversation persistence
- ✅ Response generation
- ✅ Grading accuracy

---

## 📊 Expected Results

### Passing Criteria

**All tests should pass when:**
- API is running on port 3000
- OpenAI API key is valid
- Database is accessible
- No network issues

**Test passes when:**
- All conversation steps complete
- Responses contain expected content
- Score is within expected range
- No errors thrown

### Sample Output

```
╔══════════════════════════════════════════════════════════════════════╗
║         EMT Scenario Trainer - Automated Test Suite                ║
╚══════════════════════════════════════════════════════════════════════╝

Checking API connectivity...
✓ API is reachable

Found 5 test script(s)

================================================================================
Running: Cardiac Scenario - Perfect Execution
================================================================================

Step 1/14: Student introduces self and assesses scene safety
Response: "Yes, the scene is safe. This is a 35-year-old female..."

Final Score: 36/38
✓ Score within expected range (90%-100%)
✓ PASSED in 12453ms

...

╔══════════════════════════════════════════════════════════════════════╗
║                          TEST SUMMARY                                ║
╚══════════════════════════════════════════════════════════════════════╝

Total Tests: 5
Passed: 5
Failed: 0
Duration: 58.42s
```

---

## 🔧 How Tests Work

### 1. Test Runner
- Loads all test scenarios from `test/scenarios/`
- Executes each scenario step-by-step
- Sends messages to `/api/chat` endpoint
- Validates responses contain expected content
- Gets final score from `/api/score` endpoint
- Compares score to expected range
- Reports pass/fail with details

### 2. Test Scenarios
Each scenario defines:
- **Scenario data**: Type (medical/trauma) and sub-type
- **Steps**: Array of student inputs with expected responses
- **Score range**: Expected min/max score percentage

### 3. Validation
Tests validate:
- **Response content**: Using `shouldContain` and `shouldNotContain`
- **Score accuracy**: Using `expectedScoreMin` and `expectedScoreMax`
- **No errors**: All API calls succeed

---

## 🐛 Troubleshooting

### Tests Fail: "Cannot connect to API"
**Solution**: Start the backend server
```bash
npm run dev:backend
```

### Tests Fail: Score out of range
**Possible Causes**:
1. Grading logic changed
2. AI model responses changed
3. Test expectations too strict

**Solution**: Review `services/gradingEngine.js` and adjust test expectations

### Tests Are Slow
**Possible Causes**:
1. OpenAI API rate limits
2. Network latency
3. Database slow

**Solution**: Check OpenAI dashboard, test connection speed

---

## ✅ Next Steps

1. **Run quick test** to verify setup:
   ```bash
   ./test/quick-test.sh
   ```

2. **Run full suite** before making changes:
   ```bash
   npm test
   ```

3. **Create custom tests** for new scenarios:
   - Copy an existing test from `test/scenarios/`
   - Modify steps and expectations
   - Run `npm test` to include it

4. **Integrate into CI/CD**:
   ```bash
   # In your CI script
   npm run dev:backend &
   sleep 5
   npm test
   ```

---

## 📈 Benefits

✅ **Confidence**: Know your system works before deployment  
✅ **Regression Detection**: Catch bugs when making changes  
✅ **Documentation**: Tests show how the system should behave  
✅ **Quality Assurance**: Validate scoring accuracy  
✅ **Time Savings**: Automated vs. manual testing every time  

---

## 📚 Additional Resources

- **Full Testing Guide**: `docs/TESTING_GUIDE.md`
- **Test README**: `test/README.md`
- **Example Manual Test**: `test/example-manual-test.js`
- **Quick Test Script**: `test/quick-test.sh`

---

**Status**: ✅ Complete and ready for use  
**Last Updated**: February 15, 2026  
**Total Files**: 10 files, ~50 KB of testing infrastructure
