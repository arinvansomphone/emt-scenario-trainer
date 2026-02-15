/**
 * Test Script: Metabolic Scenario - Edge Cases
 * 
 * This test checks how the system handles edge cases:
 * - Very short responses
 * - Questions to the patient
 * - Requests for clarification
 * - Non-standard assessment order
 * 
 * Expected score: 75-85%
 */

module.exports = {
  name: 'Metabolic Scenario - Edge Cases',
  
  scenarioData: {
    sunetId: 'test-metabolic-edge',
    mainScenario: 'Medical Scenario',
    subScenario: 'Metabolic Scenario'
  },

  steps: [
    {
      description: 'Student uses very short greeting',
      input: 'Hi',
      shouldContain: []
    },
    {
      description: 'Student asks for clarification',
      input: 'Can you repeat that?',
      shouldContain: []
    },
    {
      description: 'Student asks open-ended question',
      input: 'Tell me everything that\'s going on',
      shouldContain: []
    },
    {
      description: 'Student checks vitals early (non-standard but acceptable)',
      input: 'Let me check your blood sugar and vital signs first',
      shouldContain: []
    },
    {
      description: 'Student asks about diabetes history',
      input: 'Are you diabetic? When did you last eat? Did you take your insulin today?',
      shouldContain: []
    },
    {
      description: 'Student asks patient a question about their response',
      input: 'You said you felt dizzy - is that still happening?',
      shouldContain: []
    },
    {
      description: 'Student administers glucose',
      input: 'Your blood sugar is low. I\'m going to give you some glucose',
      shouldContain: []
    },
    {
      description: 'Student reassesses after treatment',
      input: 'How are you feeling now? Is the dizziness better?',
      shouldContain: []
    },
    {
      description: 'Student makes decision about transport',
      input: 'Your blood sugar is coming up. We should still get you checked out at the hospital to make sure everything is okay.',
      shouldContain: []
    }
  ],

  expectedScoreMin: 75,
  expectedScoreMax: 85
};
