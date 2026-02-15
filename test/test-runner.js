/**
 * Test Runner for EMT Scenario Trainer
 * 
 * Usage: node test/test-runner.js
 * 
 * This script runs all test scenarios and reports results
 */

const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'http://localhost:3000';

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

class TestRunner {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async runTest(testScript) {
    const testName = testScript.name;
    this.log(`\n${'='.repeat(80)}`, 'cyan');
    this.log(`Running: ${testName}`, 'blue');
    this.log(`${'='.repeat(80)}`, 'cyan');

    const testStartTime = Date.now();
    let sessionId = null;
    let conversation = [];
    let passed = false;
    let errors = [];

    try {
      // Execute each step in the test script
      for (let i = 0; i < testScript.steps.length; i++) {
        const step = testScript.steps[i];
        this.log(`\nStep ${i + 1}/${testScript.steps.length}: ${step.description}`, 'gray');
        this.log(`Input: "${step.input}"`, 'gray');

        const response = await fetch(`${API_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: step.input,
            conversation: conversation,
            scenarioData: testScript.scenarioData,
            sessionId: sessionId
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(`API Error: ${data.error}`);
        }

        // Update state
        sessionId = data.data.sessionId;
        conversation = data.data.conversation;

        const responseText = data.data.response || '';
        const displayText = typeof responseText === 'string' 
          ? responseText.substring(0, 100) 
          : String(responseText).substring(0, 100);
        this.log(`Response: "${displayText}..."`, 'gray');

        // Validate step expectations
        if (step.shouldContain) {
          for (const text of step.shouldContain) {
            const responseText = typeof data.data.response === 'string' 
              ? data.data.response 
              : JSON.stringify(data.data.response);
            if (!responseText.toLowerCase().includes(text.toLowerCase())) {
              errors.push(`Step ${i + 1}: Expected response to contain "${text}"`);
            }
          }
        }

        if (step.shouldNotContain) {
          for (const text of step.shouldNotContain) {
            const responseText = typeof data.data.response === 'string' 
              ? data.data.response 
              : JSON.stringify(data.data.response);
            if (responseText.toLowerCase().includes(text.toLowerCase())) {
              errors.push(`Step ${i + 1}: Response should NOT contain "${text}"`);
            }
          }
        }

        // Small delay to avoid overwhelming the API
        await this.sleep(500);
      }

      // Get final score
      this.log('\nGetting final score...', 'gray');
      const scoreResponse = await fetch(`${API_URL}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation: conversation,
          scenarioData: testScript.scenarioData,
          sessionId: sessionId
        })
      });

      const scoreData = await scoreResponse.json();

      if (scoreData.success) {
        const score = scoreData.data.score;
        this.log(`\nFinal Score: ${score || 'N/A'}`, 'cyan');

        // Validate expected score range
        if (testScript.expectedScoreMin !== undefined && score) {
          const scoreMatch = score.match(/(\d+)\/(\d+)/);
          if (scoreMatch) {
            const actualScore = parseInt(scoreMatch[1]);
            const maxScore = parseInt(scoreMatch[2]);
            const percentage = (actualScore / maxScore) * 100;

            if (percentage >= testScript.expectedScoreMin && percentage <= testScript.expectedScoreMax) {
              this.log(`✓ Score within expected range (${testScript.expectedScoreMin}%-${testScript.expectedScoreMax}%)`, 'green');
            } else {
              errors.push(`Score ${percentage.toFixed(0)}% outside expected range (${testScript.expectedScoreMin}%-${testScript.expectedScoreMax}%)`);
            }
          }
        }
      }

      passed = errors.length === 0;

    } catch (error) {
      errors.push(`Test execution error: ${error.message}`);
      passed = false;
    }

    const testDuration = Date.now() - testStartTime;

    // Record results
    this.results.push({
      name: testName,
      passed: passed,
      errors: errors,
      duration: testDuration
    });

    // Print results
    if (passed) {
      this.log(`\n✓ PASSED in ${testDuration}ms`, 'green');
    } else {
      this.log(`\n✗ FAILED in ${testDuration}ms`, 'red');
      errors.forEach(err => this.log(`  - ${err}`, 'red'));
    }

    return passed;
  }

  async runAllTests() {
    this.log('\n╔══════════════════════════════════════════════════════════════════════╗', 'cyan');
    this.log('║         EMT Scenario Trainer - Automated Test Suite                ║', 'cyan');
    this.log('╚══════════════════════════════════════════════════════════════════════╝', 'cyan');

    // Check API connectivity
    this.log('\nChecking API connectivity...', 'yellow');
    try {
      const response = await fetch(`${API_URL}/api/health`);
      if (response.ok) {
        this.log('✓ API is reachable', 'green');
      } else {
        throw new Error('API returned non-200 status');
      }
    } catch (error) {
      this.log('✗ Cannot connect to API. Make sure the server is running.', 'red');
      this.log(`  Error: ${error.message}`, 'red');
      process.exit(1);
    }

    // Load all test scripts
    const testDir = path.join(__dirname, 'scenarios');
    const testFiles = fs.readdirSync(testDir).filter(f => f.endsWith('.js'));

    this.log(`\nFound ${testFiles.length} test script(s)\n`, 'cyan');

    // Run each test
    for (const file of testFiles) {
      const testScript = require(path.join(testDir, file));
      await this.runTest(testScript);
      await this.sleep(1000); // Delay between tests
    }

    // Print summary
    this.printSummary();
  }

  printSummary() {
    const totalDuration = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;

    this.log('\n\n╔══════════════════════════════════════════════════════════════════════╗', 'cyan');
    this.log('║                          TEST SUMMARY                                ║', 'cyan');
    this.log('╚══════════════════════════════════════════════════════════════════════╝', 'cyan');

    this.log(`\nTotal Tests: ${this.results.length}`, 'cyan');
    this.log(`Passed: ${passed}`, 'green');
    this.log(`Failed: ${failed}`, failed > 0 ? 'red' : 'green');
    this.log(`Duration: ${(totalDuration / 1000).toFixed(2)}s`, 'cyan');

    if (failed > 0) {
      this.log('\n\nFailed Tests:', 'red');
      this.results.filter(r => !r.passed).forEach(result => {
        this.log(`\n  ✗ ${result.name}`, 'red');
        result.errors.forEach(err => this.log(`    - ${err}`, 'red'));
      });
    }

    this.log('\n');

    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run tests if executed directly
if (require.main === module) {
  const runner = new TestRunner();
  runner.runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = TestRunner;
