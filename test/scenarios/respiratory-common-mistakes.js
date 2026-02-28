/**
 * Test Script: Respiratory Scenario - Common Mistakes (60-75% Rubric Target)
 *
 * Designed to score 23-29/38 (60-75%) with:
 * - Full checkbox coverage (PPE, scene, spinal, AVPU, airway, breathing, circulation, transport, disposition)
 * - Full OPQRST and SAMPLE
 * - Respiratory-specific: oxygen, albuterol
 * - Age in radio/handover, strong leadership language
 */

module.exports = {
  name: 'Respiratory Scenario - Common Mistakes',

  scenarioData: {
    sunetId: 'test-respiratory-mistakes',
    mainScenario: 'Medical Scenario',
    subScenario: 'Respiratory Scenario'
  },

  steps: [
    // Step 1: Pre-arrival (ppe, sceneSize, spinalStab)
    {
      description: 'Pre-arrival: PPE, scene survey, spinal if indicated',
      input: 'Scene size up - scene is safe. I\'m donning gloves and PPE for body substance isolation. No spinal precautions indicated - medical patient. Hi, I\'m an EMT.',
      shouldContain: ['dispatch', 'year-old']
    },
    // Step 2: AVPU, consent, airway (patency + adjunct), breathing (effort + BVM + SpO2), hemorrhage, chief complaint
    {
      description: 'AVPU, consent, airway, breathing, chief complaint',
      input: 'Sir, are you alert? I need your consent to treat. Assessing airway patency - suction or adjunct if needed. Assessing breathing effort and rate - BVM if ineffective. Checking SpO2 and oxygen. No hemorrhage. What\'s your chief complaint?',
      shouldContain: []
    },
    // Step 3: Circulation, transport
    {
      description: 'Circulation, transport',
      input: 'Checking radial pulse and heart rate. Assessing skin color, temperature and condition. No cardiac arrest - patient has a pulse. We\'re taking you to the hospital - priority transport, ALS if needed.',
      shouldContain: []
    },
    // Step 4: OPQRST - onset, provocation, quality
    {
      description: 'OPQRST - onset, provocation, quality',
      input: 'When did this start? What were you doing? Does anything make it better or worse? Describe what you feel.',
      shouldContain: []
    },
    // Step 5: OPQRST - radiation, severity, time
    {
      description: 'OPQRST - radiation, severity, time',
      input: 'Does the shortness of breath radiate anywhere? On a scale of 1 to 10, how severe? Has it been constant or does it come and go?',
      shouldContain: []
    },
    // Step 6: SAMPLE - full elements
    {
      description: 'SAMPLE history',
      input: 'Do you have any allergies? What medications do you take? Past medical history? When did you last eat? What happened right before this started?',
      shouldContain: []
    },
    // Step 7: Vitals
    {
      description: 'Vital signs',
      input: 'Checking blood pressure, heart rate, respiratory rate, temperature, and pulse ox. Checking radial pulse.',
      shouldContain: []
    },
    // Step 8: Physical exam
    {
      description: 'Physical exam',
      input: 'I\'m going to listen to your lungs with my stethoscope. Checking your pupils.',
      shouldContain: []
    },
    // Step 9: Oxygen, albuterol, reassessment (respiratory-specific)
    {
      description: 'Oxygen, albuterol, reassessment',
      input: 'I\'m giving you oxygen and albuterol. How are you feeling now? Please stay calm - we\'ll take care of you.',
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
      input: 'I\'m giving a radio report to the hospital. 55 year old female, chief complaint breathing difficulty, ETA 5 minutes, priority transport. Calling to alert them we\'re coming.',
      shouldContain: []
    },
    // Step 12: Handover (with age)
    {
      description: 'Handover report',
      input: 'Giving my handover report - transfer of care to the nurse. 55 year old female, chief complaint breathing difficulty, findings and vitals, oxygen and albuterol given, medical history and condition.',
      shouldContain: []
    },
    // Step 13: Disposition, leadership (stronger language)
    {
      description: 'Disposition and leadership',
      input: 'Field impression possible asthma exacerbation. Destination is the ED. Priority transport with lights and sirens - reason is respiratory distress. I\'m delegating to my partner - please assist with teamwork. Scene is secure. Using situational awareness and resource management for collaborative patient care.',
      shouldContain: []
    }
  ],

  expectedScoreMin: 60,
  expectedScoreMax: 75
};
