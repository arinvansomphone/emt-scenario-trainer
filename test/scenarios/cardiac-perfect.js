/**
 * Test Script: Cardiac Scenario - Perfect Execution (90-100% Rubric Target)
 *
 * Designed to score 34-38/38 (90-100%) by explicitly hitting:
 * - All 11 checkbox items (including airway suction, breathing BVM, circulation CPR)
 * - All 9 scored sections at 2-3 points each (HPI, PMH, Vitals, Physical Exam,
 *   Medical Management, Patient Interaction, Hospital Radio, Handover, Leadership)
 */

module.exports = {
  name: 'Cardiac Scenario - Perfect Execution',

  scenarioData: {
    sunetId: 'test-cardiac-perfect',
    mainScenario: 'Medical Scenario',
    subScenario: 'Cardiac Scenario'
  },

  steps: [
    // Step 1: Pre-arrival (ppe, sceneSize, spinalStab)
    {
      description: 'Pre-arrival: PPE, scene survey, spinal if indicated',
      input: 'Scene size up - scene is safe. I\'m donning gloves and PPE for body substance isolation. No spinal precautions indicated - medical patient. Hi, I\'m an EMT.',
      shouldContain: ['dispatch', 'year-old']
    },
    // Step 2: AVPU, consent, airway (patency + suction), breathing (effort + BVM + SpO2), hemorrhage, chief complaint
    {
      description: 'AVPU, consent, airway patency and suction/adjunct, breathing assessment and BVM/SpO2, hemorrhage check',
      input: 'Sir, are you alert? I need your consent to treat. Assessing airway patency - I\'d suction or place an airway adjunct if needed. Assessing breathing effort and rate - I\'d use BVM ventilation if ineffective. Checking SpO2 and will apply oxygen. No massive hemorrhage. What\'s your chief complaint?',
      shouldContain: []
    },
    // Step 3: Circulation (pulse + skin + cardiac arrest/CPR), transport urgency
    {
      description: 'Circulation: pulse, skin, cardiac arrest assessment, transport',
      input: 'Checking radial pulse and heart rate. Assessing skin color, temperature and condition. No cardiac arrest - patient has a pulse. We\'re taking you to the hospital - priority transport, ALS if needed.',
      shouldContain: []
    },
    // Step 4: OPQRST - onset, provocation, quality (patient will respond)
    {
      description: 'OPQRST - onset, provocation, quality',
      input: 'When did this pain start? What were you doing? Does anything make it better or worse? Can you describe what the pain feels like?',
      shouldContain: []
    },
    // Step 5: OPQRST - radiation, severity, time
    {
      description: 'OPQRST - radiation, severity, time',
      input: 'Does the pain radiate to your arm or jaw? On a scale of 1 to 10, how severe? Has it been constant or does it come and go?',
      shouldContain: []
    },
    // Step 6: SAMPLE
    {
      description: 'SAMPLE history',
      input: 'Do you have any allergies or past medical history? What medications do you take? When did you last eat? What happened right before this started?',
      shouldContain: []
    },
    // Step 7: Vitals - BP, HR, RR, temp, SpO2, repeat
    {
      description: 'Vital signs - BP, HR, RR, temp, SpO2',
      input: 'Checking blood pressure, heart rate, respiratory rate, temperature, and pulse ox. Checking radial pulse.',
      shouldContain: []
    },
    // Step 8: Physical exam - inspect, palpate, auscultate, examine pupils
    {
      description: 'Physical exam - inspect, palpate, auscultate, pupils',
      input: 'I\'m going to inspect your chest, palpate your chest wall, and auscultate with my stethoscope. Let me examine your pupils.',
      shouldContain: []
    },
    // Step 9: Skin, oxygen, aspirin
    {
      description: 'Skin assessment, oxygen, aspirin, reassessment',
      input: 'Assessing skin color, temperature and condition. Applying oxygen via nasal cannula. I\'m going to give you aspirin. How are you feeling now? Is the pain any better? Please try to stay calm - we\'re going to take good care of you. I understand.',
      shouldContain: []
    },
    // Step 10: Repeat vitals
    {
      description: 'Repeat vitals',
      input: 'Let me get a second set of vitals. Recheck vitals.',
      shouldContain: []
    },
    // Step 11: Hospital radio - age, chief complaint, ETA, priority, transport, coming
    {
      description: 'Hospital radio notification',
      input: 'I\'m giving a radio report to the hospital. 65 year old male, chief complaint of chest pain, priority transport, ETA 5 minutes. Calling to alert them we\'re coming.',
      shouldContain: []
    },
    // Step 12: Handover - age, complaint, findings, vitals, treatments, history, condition
    {
      description: 'Handover report',
      input: 'Giving my handover report - transfer of care to the nurse. 65 year old male, chief complaint chest pain, findings and vitals, treatments given, medical history and condition.',
      shouldContain: []
    },
    // Step 13: Disposition - field impression, destination, priority, justification. Leadership - delegate, partner, safety, situational awareness
    {
      description: 'Disposition and leadership',
      input: 'Field impression possible MI. Destination is the ED. Priority transport with lights and sirens - reason is possible cardiac event. I\'m delegating to my partner - please assist with teamwork. Scene is secure. Using situational awareness and resource management for collaborative patient care.',
      shouldContain: []
    }
  ],

  expectedScoreMin: 90,
  expectedScoreMax: 100
};
