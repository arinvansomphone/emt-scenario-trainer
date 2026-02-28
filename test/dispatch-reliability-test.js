/**
 * Dispatch Reliability Test
 *
 * Generates random medical and trauma scenarios and counts successes vs failures.
 * Runs directly against TemplateGenerator (no API server needed).
 *
 * Usage: node test/dispatch-reliability-test.js
 *
 * Runs: 20 random medical + 20 random trauma = 40 total
 *
 * Requires: OPENAI_API_KEY in .env
 */

require('dotenv').config();

const TemplateGenerator = require('../services/templateGenerator');
const templateGenerator = new TemplateGenerator();

const MEDICAL_SCENARIOS = [
  'Cardiac Scenario',
  'Respiratory Scenario',
  'Neurologic Scenario',
  'Metabolic Scenario'
];

const TRAUMA_SCENARIOS = [
  'MVC Scenario',
  'Fall Scenario',
  'Assault Scenario',
  'Sport Injury Scenario',
  'Stabbing Scenario',
  'GSW Scenario',
  'Burn Scenario'
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function runBatch(category, scenarios, count) {
  const results = { success: 0, fail: 0, failureReasons: {} };

  for (let i = 0; i < count; i++) {
    const subScenario = pickRandom(scenarios);
    const scenarioData = {
      mainScenario: category === 'trauma' ? 'Trauma Scenario' : 'Medical Scenario',
      subScenario
    };

    process.stdout.write(`  [${i + 1}/${count}] ${subScenario.padEnd(24)} `);

    try {
      const result = await templateGenerator.generateCompleteScenario(scenarioData);

      if (result.error) {
        results.fail++;
        const reason = result.message || 'Unknown';
        results.failureReasons[reason] = (results.failureReasons[reason] || 0) + 1;
        console.log('❌ FAIL');
      } else {
        results.success++;
        console.log('✓ OK');
      }
    } catch (err) {
      results.fail++;
      const reason = err.message || 'Exception';
      results.failureReasons[reason] = (results.failureReasons[reason] || 0) + 1;
      console.log('❌ FAIL');
    }

    await new Promise(r => setTimeout(r, 300));
  }

  return results;
}

async function runDispatchReliabilityTest() {
  const medicalCount = 20;
  const traumaCount = 20;

  console.log('\n📋 Dispatch Reliability Test');
  console.log(`   Medical: ${medicalCount} random | Trauma: ${traumaCount} random\n`);

  console.log('--- Medical Scenarios (20 random) ---');
  const medical = await runBatch('medical', MEDICAL_SCENARIOS, medicalCount);

  console.log('\n--- Trauma Scenarios (20 random) ---');
  const trauma = await runBatch('trauma', TRAUMA_SCENARIOS, traumaCount);

  // Report
  const printCategory = (name, r) => {
    const total = r.success + r.fail;
    const failRate = total > 0 ? ((r.fail / total) * 100).toFixed(1) : 0;
    console.log(`  ${name}:`);
    console.log(`    Success: ${r.success}  Failed: ${r.fail}  Fail rate: ${failRate}%`);
    if (r.fail > 0 && Object.keys(r.failureReasons).length > 0) {
      Object.entries(r.failureReasons)
        .sort((a, b) => b[1] - a[1])
        .forEach(([reason, n]) => console.log(`      ${reason}: ${n}`));
    }
  };

  console.log('\n' + '='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));
  printCategory('Medical', medical);
  console.log('');
  printCategory('Trauma', trauma);
  console.log('');
  const totalFailureReasons = {};
  Object.entries(medical.failureReasons).forEach(([k, v]) => { totalFailureReasons[k] = (totalFailureReasons[k] || 0) + v; });
  Object.entries(trauma.failureReasons).forEach(([k, v]) => { totalFailureReasons[k] = (totalFailureReasons[k] || 0) + v; });
  printCategory('Total', {
    success: medical.success + trauma.success,
    fail: medical.fail + trauma.fail,
    failureReasons: totalFailureReasons
  });
  console.log('');

  const totalFail = medical.fail + trauma.fail;
  process.exit(totalFail > 0 ? 1 : 0);
}

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY required. Set it in .env');
  process.exit(1);
}

runDispatchReliabilityTest().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
