/**
 * Test Script: Respiratory Scenario - Common Mistakes
 * 
 * This test simulates a student making common mistakes:
 * - Skips scene safety
 * - Misses parts of OPQRST
 * - Doesn't gather complete SAMPLE history
 * - Delays oxygen administration
 * 
 * Expected score: 60-75%
 */

module.exports = {
  name: 'Respiratory Scenario - Common Mistakes',
  
  scenarioData: {
    sunetId: 'test-respiratory-mistakes',
    mainScenario: 'Medical Scenario',
    subScenario: 'Respiratory Scenario'
  },

  steps: [
    {
      description: 'Student jumps in without scene safety check',
      input: 'What\'s wrong? What\'s happening?',
      shouldContain: ['breath', 'breathing', 'air']
    },
    {
      description: 'Student asks vague question instead of specific chief complaint',
      input: 'Tell me about it',
      shouldContain: []
    },
    {
      description: 'Student skips OPQRST and goes straight to vitals',
      input: 'Let me check your vital signs',
      shouldContain: []
    },
    {
      description: 'Student asks only one SAMPLE question',
      input: 'Do you have any medical conditions?',
      shouldContain: []
    },
    {
      description: 'Student delays oxygen (should have been done earlier)',
      input: 'I\'m going to give you oxygen now',
      shouldContain: []
    },
    {
      description: 'Student forgets to check allergies before medication',
      input: 'I\'m going to give you albuterol for your breathing',
      shouldContain: []
    },
    {
      description: 'Student arranges transport without reassessing',
      input: 'We\'re taking you to the hospital',
      shouldContain: []
    }
  ],

  expectedScoreMin: 60,
  expectedScoreMax: 75
};
