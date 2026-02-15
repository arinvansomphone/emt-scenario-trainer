/**
 * Test Script: Cardiac Scenario - Perfect Execution
 * 
 * This test simulates a student performing a cardiac scenario
 * with perfect protocol adherence. Expected score: 90-100%
 */

module.exports = {
  name: 'Cardiac Scenario - Perfect Execution',
  
  scenarioData: {
    sunetId: 'test-cardiac-perfect',
    mainScenario: 'Medical Scenario',
    subScenario: 'Cardiac Scenario'
  },

  steps: [
    {
      description: 'Student introduces self and assesses scene safety',
      input: 'Hi, I\'m an EMT. Is the scene safe? What\'s going on here?',
      shouldContain: ['yes', 'safe', 'chest', 'pain'],
      shouldNotContain: ['heart attack', 'myocardial infarction', 'MI']
    },
    {
      description: 'Student asks chief complaint',
      input: 'What\'s your chief complaint? What brings us here today?',
      shouldContain: ['chest', 'pain', 'hurt', 'discomfort']
    },
    {
      description: 'Student performs OPQRST assessment - Onset',
      input: 'When did this pain start?',
      shouldContain: ['ago', 'start', 'began', 'minutes', 'hours']
    },
    {
      description: 'Student performs OPQRST assessment - Provocation',
      input: 'What were you doing when the pain started? Does anything make it better or worse?',
      shouldContain: []
    },
    {
      description: 'Student performs OPQRST assessment - Quality',
      input: 'Can you describe the pain? What does it feel like?',
      shouldContain: ['pressure', 'tight', 'squeezing', 'crushing', 'heavy']
    },
    {
      description: 'Student performs OPQRST assessment - Radiation',
      input: 'Does the pain go anywhere else? Does it radiate?',
      shouldContain: []
    },
    {
      description: 'Student performs OPQRST assessment - Severity',
      input: 'On a scale of 1 to 10, with 10 being the worst pain you\'ve ever felt, how would you rate this pain?',
      shouldContain: ['8', '9', '10', 'severe']
    },
    {
      description: 'Student performs OPQRST assessment - Time',
      input: 'Has the pain been constant or does it come and go?',
      shouldContain: []
    },
    {
      description: 'Student gathers SAMPLE history',
      input: 'Do you have any medical history I should know about? Any medications? Allergies?',
      shouldContain: []
    },
    {
      description: 'Student takes vital signs',
      input: 'I\'m going to check your vital signs now. Let me take your blood pressure, pulse, and oxygen level.',
      shouldContain: ['pressure', 'pulse', 'oxygen', 'breathing']
    },
    {
      description: 'Student administers oxygen',
      input: 'I\'m going to put you on oxygen to help you breathe better.',
      shouldContain: []
    },
    {
      description: 'Student administers aspirin',
      input: 'I\'m going to give you aspirin to chew. This will help with the chest pain.',
      shouldContain: []
    },
    {
      description: 'Student provides reassurance',
      input: 'We\'re going to take good care of you. Try to stay calm and relax.',
      shouldContain: []
    },
    {
      description: 'Student arranges transport',
      input: 'We\'re going to transport you to the hospital right away. I\'ll notify them that we\'re coming.',
      shouldContain: ['hospital', 'transport']
    }
  ],

  expectedScoreMin: 90,
  expectedScoreMax: 100
};
