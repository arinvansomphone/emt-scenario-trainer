# EMT Scenario Trainer - Test Suite

This directory contains automated test scripts for the EMT Scenario Trainer chatbot.

## Overview

The test suite simulates student interactions with various EMT scenarios and validates:
- Correct patient responses
- Appropriate scoring
- System reliability
- Edge case handling

## Structure

```
test/
├── test-runner.js           # Main test execution engine
├── test-scenario-types.js   # Scenario type appropriateness (dispatch matches selection)
├── scenarios/               # Individual test scripts
│   ├── cardiac-perfect.js              # Perfect cardiac scenario execution
│   ├── respiratory-common-mistakes.js  # Common errors in respiratory scenario
│   ├── trauma-critical-errors.js       # Critical errors in trauma scenario
│   ├── neurological-good.js            # Good neurological performance
│   └── metabolic-edge-case.js          # Edge cases and unusual inputs
└── README.md               # This file
```

## Running Tests

### Prerequisites

1. Start the backend server:
   ```bash
   npm run dev:backend
   ```

2. Ensure the API is accessible at `http://localhost:3000`

### Run All Tests

```bash
npm test
# or
node test/test-runner.js
```

### Run Scenario Type Appropriateness Test

Verifies that each selected scenario type (e.g. Medical Respiratory, Trauma MVC) produces a dispatch with appropriate keywords for that patient type. Covers all types offered in the selection screen.

```bash
npm run test:scenario-types
# or
node test/test-scenario-types.js
```

### Run Individual Test

```bash
node -e "require('./test/test-runner.js').runTest(require('./test/scenarios/cardiac-perfect.js'))"
```

## Test Scripts Explained

### Scenario Type Appropriateness (`test-scenario-types.js`)

**Purpose:** Ensures that selecting a scenario type produces an appropriate scenario. For each type offered in the app (e.g. Medical → Respiratory, Trauma → MVC), the test sends one message to get the initial dispatch and asserts the response contains expected keywords for that patient type (e.g. "breathing", "asthma" for Respiratory; "car", "accident" for MVC).

**Scenario types covered:** All medical sub-types (Respiratory, Cardiac, Neurologic, Metabolic, Abdominal, Environmental, OB/GYN) and all trauma sub-types (MVC, Fall, Assault, Sport Injury, Stabbing, GSW, Burn).

**Usage:** `npm run test:scenario-types`

### 1. Cardiac Scenario - Perfect Execution
**File:** `cardiac-perfect.js`
**Purpose:** Validates that perfect protocol adherence scores 90-100%
**Key Points:**
- Scene safety assessment
- Complete OPQRST evaluation
- Full SAMPLE history
- Appropriate interventions (oxygen, aspirin)
- Timely transport

### 2. Respiratory Scenario - Common Mistakes
**File:** `respiratory-common-mistakes.js`
**Purpose:** Tests scoring when student makes common errors
**Key Points:**
- Skips scene safety
- Incomplete assessment
- Delayed interventions
- Expected score: 60-75%

### 3. Trauma Scenario - Critical Errors
**File:** `trauma-critical-errors.js`
**Purpose:** Validates that critical errors result in failure
**Key Points:**
- No scene safety
- Fails to stabilize spine
- Wrong assessment order
- Expected score: <60% (fail)

### 4. Neurological Scenario - Good Performance
**File:** `neurological-good.js`
**Purpose:** Tests competent performance with minor mistakes
**Key Points:**
- Proper stroke assessment (Cincinnati Scale)
- Good but not perfect execution
- Expected score: 80-90%

### 5. Metabolic Scenario - Edge Cases
**File:** `metabolic-edge-case.js`
**Purpose:** Tests system robustness with unusual inputs
**Key Points:**
- Very short responses
- Questions to the patient
- Non-standard assessment order
- Clarification requests
- Expected score: 75-85%

## Creating New Test Scripts

To create a new test script:

1. Create a new file in `test/scenarios/`
2. Export an object with this structure:

```javascript
module.exports = {
  name: 'Test Name',
  
  scenarioData: {
    sunetId: 'test-id',
    mainScenario: 'Medical Scenario' or 'Trauma Scenario',
    subScenario: 'Specific scenario type'
  },

  steps: [
    {
      description: 'What this step tests',
      input: 'Student message',
      shouldContain: ['expected', 'words'],  // Optional
      shouldNotContain: ['forbidden', 'words']  // Optional
    }
    // ... more steps
  ],

  expectedScoreMin: 80,  // Optional: minimum expected score %
  expectedScoreMax: 90   // Optional: maximum expected score %
};
```

3. Run the test runner to include your new test

## Test Output

The test runner provides:
- ✓ or ✗ for each test
- Detailed step-by-step execution logs
- Final scores for each scenario
- Summary of passed/failed tests
- Total execution time

### Example Output

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
Input: "Hi, I'm an EMT. Is the scene safe? What's going on here?"
Response: "Yes, the scene is safe. This is a 35-year-old female..."

...

Final Score: 36/38

✓ Score within expected range (90%-100%)

✓ PASSED in 12453ms
```

## Continuous Integration

To integrate with CI/CD:

```bash
#!/bin/bash
# Start server in background
npm run dev:backend &
SERVER_PID=$!

# Wait for server to be ready
sleep 5

# Run tests
node test/test-runner.js
TEST_EXIT_CODE=$?

# Cleanup
kill $SERVER_PID

exit $TEST_EXIT_CODE
```

## Interpreting Results

### Test Passes
- All steps executed successfully
- Responses contained expected content
- Score within expected range
- No errors thrown

### Test Fails
Common failure reasons:
1. **API connectivity issues** - Check if server is running
2. **Unexpected responses** - AI model may vary; adjust expectations
3. **Score out of range** - Grading logic may need adjustment
4. **Timeout** - Responses taking too long; check OpenAI API

## Best Practices

1. **Keep tests focused** - Each test should validate one scenario
2. **Use realistic inputs** - Match how real students would interact
3. **Update regularly** - As system improves, update expected scores
4. **Run before deployment** - Always run full suite before pushing changes
5. **Monitor trends** - Track if tests start failing over time

## Troubleshooting

### "Cannot connect to API"
- Ensure backend is running: `npm run dev:backend`
- Check port 3000 is not in use by another process

### "Score out of expected range"
- Review grading logic in `services/gradingEngine.js`
- Check if test expectations are realistic
- Consider if AI model behavior has changed

### Tests are flaky
- AI responses can vary slightly between runs
- Use broader `shouldContain` checks
- Avoid exact string matching
- Consider multiple runs to identify patterns

## Future Enhancements

- [ ] Add performance benchmarks
- [ ] Test voice input scenarios
- [ ] Validate conversation summarization
- [ ] Test session persistence
- [ ] Load testing with concurrent scenarios
- [ ] Screenshot testing for feedback page
- [ ] Integration with instructor grading data

## Contributing

When adding new scenarios to the app, create corresponding test scripts:
1. Perfect execution test
2. Common mistakes test
3. Edge cases test

This ensures comprehensive coverage as the system grows.
