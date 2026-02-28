/**
 * Test Script: Neurological Scenario - Good Performance (80-90% Rubric Target)
 *
 * Designed to score 31-34/38 (80-90%) by hitting:
 * - All 11 checkbox items (pre-arrival, primary survey, disposition)
 * - Scored sections at 2-3 points each
 * - Neurological-specific: stroke assessment, Cincinnati scale, possible stroke
 */

module.exports = {
  name: 'Neurological Scenario - Good Performance',

  scenarioData: {
    sunetId: 'test-neuro-good',
    mainScenario: 'Medical Scenario',
    subScenario: 'Neurologic Scenario'
  },

  steps: [
    // Step 1: Pre-arrival (ppe, sceneSize, spinalStab)
    {
      description: 'Pre-arrival: PPE, scene survey, spinal if indicated',
      input: 'Scene size up - scene is safe. I\'m donning gloves and PPE for body substance isolation. No spinal precautions indicated - medical patient. Hi, I\'m an EMT.',
      shouldContain: ['dispatch', 'year-old']
    },
    // Step 2: AVPU, consent, airway, breathing, hemorrhage, chief complaint
    {
      description: 'AVPU, consent, airway, breathing, hemorrhage, chief complaint',
      input: 'Sir, are you alert? I need your consent to treat. Assessing airway patency - I\'d suction or place an airway adjunct if needed. Assessing breathing effort and rate - I\'d use BVM ventilation if ineffective. Checking SpO2 and will apply oxygen. No massive hemorrhage. What\'s your chief complaint?',
      shouldContain: []
    },
    // Step 3: Circulation, transport
    {
      description: 'Circulation, transport decision',
      input: 'Checking radial pulse and heart rate. Assessing skin color, temperature and condition. No cardiac arrest - patient has a pulse. We\'re taking you to the hospital - priority transport, ALS if needed.',
      shouldContain: []
    },
    // Step 4: HPI - onset, provocation, quality
    {
      description: 'HPI - onset, provocation, quality',
      input: 'When did this start? What were you doing? Does anything make it better or worse? Can you describe what you feel?',
      shouldContain: []
    },
    // Step 5: HPI - radiation, severity, time
    {
      description: 'HPI - radiation, severity, time',
      input: 'Does the headache radiate anywhere? On a scale of 1 to 10, how severe? Has it been constant or does it come and go?',
      shouldContain: []
    },
    // Step 6: SAMPLE
    {
      description: 'SAMPLE history',
      input: 'Do you have any allergies or past medical history? What medications do you take? When did you last eat? What happened right before this started?',
      shouldContain: []
    },
    // Step 7: Vitals
    {
      description: 'Vital signs',
      input: 'Checking blood pressure, heart rate, respiratory rate, temperature, and pulse ox. Checking radial pulse.',
      shouldContain: []
    },
    // Step 8: Physical exam - Cincinnati Stroke Scale, pupils, inspect, palpate, auscultate
    {
      description: 'Physical exam - Cincinnati scale, pupils',
      input: 'I need you to smile for me. Can you raise both arms? Repeat this sentence after me. I\'m going to inspect, palpate, and auscultate with my stethoscope. Let me examine your pupils.',
      shouldContain: []
    },
    // Step 9: Skin, oxygen, reassessment (neuro: oxygen, no aspirin)
    {
      description: 'Skin assessment, oxygen, reassessment',
      input: 'Assessing skin color, temperature and condition. Applying oxygen via nasal cannula. How are you feeling now? Please try to stay calm - we\'re going to take good care of you. I understand.',
      shouldContain: []
    },
    // Step 10: Repeat vitals
    {
      description: 'Repeat vitals',
      input: 'Let me get a second set of vitals. Recheck vitals.',
      shouldContain: []
    },
    // Step 11: Hospital radio
    {
      description: 'Hospital radio notification',
      input: 'I\'m giving a radio report to the hospital. 65 year old male, chief complaint possible stroke, priority transport, ETA 5 minutes. Calling to alert them we\'re coming.',
      shouldContain: []
    },
    // Step 12: Handover
    {
      description: 'Handover report',
      input: 'Giving my handover report - transfer of care to the nurse. 65 year old male, chief complaint possible stroke, findings and vitals, treatments given, medical history and condition.',
      shouldContain: []
    },
    // Step 13: Disposition, leadership (slightly shorter for 80-90% target)
    {
      description: 'Disposition and leadership',
      input: 'Field impression possible stroke. Destination is the ED. Priority transport with lights and sirens - reason is time-critical stroke. I\'m delegating to my partner. Scene is secure. Situational awareness and resource management.',
      shouldContain: []
    }
  ],

  expectedScoreMin: 80,
  expectedScoreMax: 90
};
