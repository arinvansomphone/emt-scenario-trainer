/**
 * Scenario Type Appropriateness Test
 *
 * Verifies that selecting a scenario type produces an appropriate scenario.
 * For each type (e.g. Medical Respiratory), sends one message to get the dispatch
 * and asserts the response contains expected keywords for that patient type.
 *
 * Usage: node test/test-scenario-types.js
 * Or:    npm run test:scenario-types
 *
 * Requires: Backend running on port 3000 (or API_URL).
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Scenario types offered in the app (SelectionScreen) and keywords that
 * should appear in the dispatch/first response for that type.
 * At least one keyword in each array must be present (case-insensitive).
 */
const SCENARIO_TYPES = [
  // Medical scenarios
  {
    mainScenario: 'Medical Scenario',
    subScenario: 'Respiratory Scenario',
    expectedKeywords: [
      'breathing',
      'respiratory',
      'asthma',
      'shortness of breath',
      'wheez',
      'chest tight',
      'dyspnea',
      'breath',
      'difficulty breathing',
      'sob',
    ],
  },
  {
    mainScenario: 'Medical Scenario',
    subScenario: 'Cardiac Scenario',
    expectedKeywords: [
      'chest',
      'cardiac',
      'heart',
      'pressure',
      'pain',
      'chest pain',
      'tightness',
      'dizziness',
    ],
  },
  {
    mainScenario: 'Medical Scenario',
    subScenario: 'Neurologic Scenario',
    expectedKeywords: [
      'stroke',
      'neurologic',
      'neurological',
      'confus',
      'weakness',
      'facial',
      'slurr',
      'headache',
      'speech',
      'numb',
      'vision',
    ],
  },
  {
    mainScenario: 'Medical Scenario',
    subScenario: 'Metabolic Scenario',
    expectedKeywords: [
      'diabetic',
      'blood sugar',
      'glucose',
      'insulin',
      'metabolic',
      'dka',
      'hypoglycemia',
      'diabetes',
      'sugar',
      'confusion',
      'weakness',
      'unresponsive',
      'altered',
      'mental status',
      'shaking',
    ],
  },
  {
    mainScenario: 'Medical Scenario',
    subScenario: 'Abdominal Scenario',
    expectedKeywords: [
      'abdominal',
      'stomach',
      'belly',
      'pain',
      'nausea',
      'appendix',
      'abdomen',
      'vomit',
      'guarding',
      'weakness',
      'weak',
    ],
  },
  {
    mainScenario: 'Medical Scenario',
    subScenario: 'Environmental Scenario',
    expectedKeywords: [
      'heat',
      'cold',
      'hypothermia',
      'hyperthermia',
      'exposure',
      'environmental',
      'dehydration',
      'overheat',
      'frostbite',
    ],
  },
  {
    mainScenario: 'Medical Scenario',
    subScenario: 'OB/GYN Scenario',
    expectedKeywords: [
      'pregnant',
      'labor',
      'delivery',
      'obstetric',
      'baby',
      'contraction',
      'birth',
      'pregnancy',
    ],
  },
  // Trauma scenarios
  {
    mainScenario: 'Trauma Scenario',
    subScenario: 'MVC Scenario',
    expectedKeywords: [
      'car',
      'accident',
      'mvc',
      'vehicle',
      'collision',
      'motor vehicle',
      'crash',
    ],
  },
  {
    mainScenario: 'Trauma Scenario',
    subScenario: 'Fall Scenario',
    expectedKeywords: ['fall', 'fell', 'fallen', 'tripped', 'ladder', 'height'],
  },
  {
    mainScenario: 'Trauma Scenario',
    subScenario: 'Assault Scenario',
    expectedKeywords: ['assault', 'hit', 'attacked', 'struck', 'beaten', 'attack'],
  },
  {
    mainScenario: 'Trauma Scenario',
    subScenario: 'Sport Injury Scenario',
    expectedKeywords: [
      'sport',
      'game',
      'playing',
      'athletic',
      'practice',
      'field',
      'injury',
    ],
  },
  {
    mainScenario: 'Trauma Scenario',
    subScenario: 'Stabbing Scenario',
    expectedKeywords: ['stab', 'stabbing', 'knife', 'cut', 'puncture'],
  },
  {
    mainScenario: 'Trauma Scenario',
    subScenario: 'GSW Scenario',
    expectedKeywords: ['gunshot', 'gsw', 'shot', 'bullet', 'gun', 'shooting'],
  },
  {
    mainScenario: 'Trauma Scenario',
    subScenario: 'Burn Scenario',
    expectedKeywords: ['burn', 'burned', 'fire', 'scald', 'flame', 'hot'],
  },
];

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function responseContainsKeyword(text, keyword) {
  if (typeof text !== 'string') text = String(text);
  return text.toLowerCase().includes(keyword.toLowerCase());
}

async function checkScenarioType(entry, index, total) {
  const { mainScenario, subScenario, expectedKeywords } = entry;
  const scenarioData = {
    sunetId: `scenario-type-test-${index}`,
    mainScenario,
    subScenario,
  };

  try {
    const res = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hi, what is the situation?',
        conversation: [],
        scenarioData,
      }),
    });

    if (!res.ok) {
      return {
        name: `${mainScenario} - ${subScenario}`,
        passed: false,
        error: `HTTP ${res.status}: ${res.statusText}`,
        dispatch: null,
      };
    }

    const data = await res.json();
    if (!data.success) {
      return {
        name: `${mainScenario} - ${subScenario}`,
        passed: false,
        error: data.error || 'API returned success: false',
        dispatch: null,
      };
    }

    const responseText = data.data.response;
    const text = typeof responseText === 'string' ? responseText : String(responseText);

    const found = expectedKeywords.some((kw) => responseContainsKeyword(text, kw));
    if (!found) {
      return {
        name: `${mainScenario} - ${subScenario}`,
        passed: false,
        error: `Dispatch did not contain any of: [${expectedKeywords.slice(0, 5).join(', ')}...]. Got: "${text}"`,
        dispatch: text,
      };
    }

    return {
      name: `${mainScenario} - ${subScenario}`,
      passed: true,
      dispatch: text,
    };
  } catch (err) {
    return {
      name: `${mainScenario} - ${subScenario}`,
      passed: false,
      error: err.message,
      dispatch: null,
    };
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  log('\n╔══════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║         Scenario Type Appropriateness Test                           ║', 'cyan');
  log('╚══════════════════════════════════════════════════════════════════════╝', 'cyan');

  log('\nChecking API connectivity...', 'yellow');
  try {
    const health = await fetch(`${API_URL}/api/health`);
    if (!health.ok) throw new Error('API returned non-200');
    log('✓ API is reachable\n', 'green');
  } catch (e) {
    log('✗ Cannot connect to API. Start the backend (e.g. npm run dev).', 'red');
    log(`  ${e.message}`, 'red');
    process.exit(1);
  }

  const total = SCENARIO_TYPES.length;
  const results = [];

  for (let i = 0; i < total; i++) {
    const entry = SCENARIO_TYPES[i];
    log(`\n[${i + 1}/${total}] ${entry.mainScenario} - ${entry.subScenario}`, 'blue');
    const result = await checkScenarioType(entry, i, total);
    results.push(result);
    if (result.dispatch != null) {
      log('  Dispatch:', 'gray');
      log(`  ${result.dispatch.split('\n').join('\n  ')}`, 'gray');
    }
    if (result.passed) {
      log('  ✓ Passed', 'green');
    } else {
      log(`  ✗ Failed: ${result.error}`, 'red');
    }
    await sleep(400);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  log('\n╔══════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║                          SUMMARY                                      ║', 'cyan');
  log('╚══════════════════════════════════════════════════════════════════════╝', 'cyan');
  log(`\nTotal: ${total}  |  Passed: ${passed}  |  Failed: ${failed}`, failed ? 'red' : 'green');
  if (failed > 0) {
    log('\nFailed scenario types:', 'red');
    results.filter((r) => !r.passed).forEach((r) => {
      log(`  • ${r.name}: ${r.error}`, 'red');
    });
  }
  log('\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
