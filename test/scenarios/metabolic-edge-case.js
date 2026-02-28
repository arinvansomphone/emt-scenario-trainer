/**
 * Test Script: Metabolic Scenario - 75-85% Rubric Target
 *
 * Designed to score 29-32/38 (75-85%) with:
 * - Full checkbox coverage
 * - Metabolic-specific: hypoglycemia, glucose, blood sugar
 * - Age in radio/handover, strong leadership language
 */

module.exports = {
  name: 'Metabolic Scenario - Edge Cases',

  scenarioData: {
    sunetId: 'test-metabolic-edge',
    mainScenario: 'Medical Scenario',
    subScenario: 'Metabolic Scenario'
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
      description: 'AVPU, consent, airway patency and suction/adjunct, breathing and BVM/SpO2, hemorrhage check',
      input: 'Sir, are you alert? I need your consent to treat. Assessing airway patency - I\'d suction or place an airway adjunct if needed. Assessing breathing effort and rate - I\'d use BVM ventilation if ineffective. Checking SpO2 and will apply oxygen. No massive hemorrhage. What\'s your chief complaint?',
      shouldContain: []
    },
    // Step 3: Circulation (pulse + skin + cardiac arrest), transport
    {
      description: 'Circulation, transport decision',
      input: 'Checking radial pulse and heart rate. Assessing skin color, temperature and condition. No cardiac arrest - patient has a pulse. We\'re taking you to the hospital - priority transport, ALS if needed.',
      shouldContain: []
    },
    // Step 4: OPQRST - onset, provocation, quality
    {
      description: 'HPI - onset, provocation, quality',
      input: 'When did you start feeling this way? What were you doing? Does anything make it better or worse? Can you describe what you feel?',
      shouldContain: []
    },
    // Step 5: OPQRST - radiation, severity, time
    {
      description: 'HPI - radiation, severity, time',
      input: 'On a scale of 1 to 10, how severe? Has it been constant or does it come and go?',
      shouldContain: []
    },
    // Step 6: SAMPLE
    {
      description: 'SAMPLE history',
      input: 'Do you have any allergies or past medical history? What medications do you take? When did you last eat? What happened right before this started?',
      shouldContain: []
    },
    // Step 7: Vitals - BP, HR, RR, temp, SpO2
    {
      description: 'Vital signs',
      input: 'Checking blood pressure, heart rate, respiratory rate, temperature, pulse ox, and blood sugar. Checking radial pulse.',
      shouldContain: []
    },
    // Step 8: Physical exam
    {
      description: 'Physical exam',
      input: 'I\'m going to inspect, palpate your chest, and auscultate with my stethoscope. Let me examine your pupils.',
      shouldContain: []
    },
    // Step 9: Skin, oxygen, glucose, reassessment (metabolic-specific)
    {
      description: 'Skin assessment, oxygen, glucose, reassessment',
      input: 'Assessing skin color, temperature and condition. Applying oxygen via nasal cannula. I\'m going to give you glucose. How are you feeling now? Is the dizziness better? Please try to stay calm - we\'re going to take good care of you. I understand.',
      shouldContain: []
    },
    // Step 10: Repeat vitals
    {
      description: 'Repeat vitals',
      input: 'Let me get a second set of vitals. Recheck vitals.',
      shouldContain: []
    },
    // Step 11: Hospital radio (with age)
    {
      description: 'Hospital radio notification',
      input: 'I\'m giving a radio report to the hospital. 35 year old male, chief complaint hypoglycemia, ETA 5 minutes, priority transport. Calling to alert them we\'re coming.',
      shouldContain: []
    },
    // Step 12: Handover (with age)
    {
      description: 'Handover report',
      input: 'Giving my handover report - transfer of care to the nurse. 35 year old male, chief complaint hypoglycemia, findings and vitals, glucose given, medical history and condition.',
      shouldContain: []
    },
    // Step 13: Disposition, leadership (stronger language)
    {
      description: 'Disposition and leadership',
      input: 'Field impression possible hypoglycemia. Destination is the ED. Priority transport with lights and sirens - reason is hypoglycemia. I\'m delegating to my partner - please assist with teamwork. Scene is secure. Using situational awareness and resource management for collaborative patient care.',
      shouldContain: []
    }
  ],

  expectedScoreMin: 75,
  expectedScoreMax: 85
};
