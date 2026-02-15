/**
 * Test Script: Neurological Scenario - Good Performance
 * 
 * This test simulates a competent student who does most things right
 * but makes a few minor mistakes. Expected score: 80-90%
 */

module.exports = {
  name: 'Neurological Scenario - Good Performance',
  
  scenarioData: {
    sunetId: 'test-neuro-good',
    mainScenario: 'Medical Scenario',
    subScenario: 'Neurologic Scenario'
  },

  steps: [
    {
      description: 'Student properly assesses scene safety',
      input: 'Scene safety check - is it safe to approach? Hi, I\'m an EMT. What\'s going on?',
      shouldContain: ['yes', 'safe']
    },
    {
      description: 'Student asks about chief complaint',
      input: 'What brings us here today? What\'s the problem?',
      shouldContain: ['head', 'dizzy', 'confused', 'weakness']
    },
    {
      description: 'Student performs partial OPQRST - asks onset',
      input: 'When did this start?',
      shouldContain: []
    },
    {
      description: 'Student performs partial OPQRST - asks severity',
      input: 'How bad is it?',
      shouldContain: []
    },
    {
      description: 'Student performs Cincinnati Stroke Scale',
      input: 'I need you to smile for me. Can you raise both arms? Can you repeat this sentence after me?',
      shouldContain: []
    },
    {
      description: 'Student checks pupils',
      input: 'I\'m going to check your pupils with this light',
      shouldContain: []
    },
    {
      description: 'Student gathers SAMPLE history',
      input: 'Do you have any medical conditions? Are you on any medications? Any allergies?',
      shouldContain: []
    },
    {
      description: 'Student takes vital signs',
      input: 'Let me check your blood pressure, pulse, and oxygen saturation',
      shouldContain: []
    },
    {
      description: 'Student positions patient appropriately',
      input: 'I\'m going to keep you lying down with your head elevated slightly',
      shouldContain: []
    },
    {
      description: 'Student arranges rapid transport (time-critical)',
      input: 'This could be serious. We need to get you to the hospital quickly. I\'m calling ahead to alert them.',
      shouldContain: []
    }
  ],

  expectedScoreMin: 80,
  expectedScoreMax: 90
};
