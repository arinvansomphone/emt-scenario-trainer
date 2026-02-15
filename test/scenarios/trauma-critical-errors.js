/**
 * Test Script: Trauma Scenario - Critical Errors
 * 
 * This test simulates a student making critical errors:
 * - No scene safety assessment
 * - Fails to stabilize C-spine
 * - Doesn't check for life-threatening bleeding
 * - Poor assessment order
 * 
 * Expected score: <60% (failing)
 */

module.exports = {
  name: 'Trauma Scenario - Critical Errors',
  
  scenarioData: {
    sunetId: 'test-trauma-critical',
    mainScenario: 'Trauma Scenario',
    subScenario: 'MVC Scenario'
  },

  steps: [
    {
      description: 'Student approaches without scene safety',
      input: 'Are you okay? What hurts?',
      shouldContain: []
    },
    {
      description: 'Student asks about minor injuries before checking ABC',
      input: 'Where does it hurt the most?',
      shouldContain: []
    },
    {
      description: 'Student delays checking airway and breathing',
      input: 'Can you tell me what happened?',
      shouldContain: []
    },
    {
      description: 'Student finally checks vitals but too late',
      input: 'Let me check your blood pressure',
      shouldContain: []
    },
    {
      description: 'Student still hasn\'t stabilized spine',
      input: 'Do you have any medical history?',
      shouldContain: []
    },
    {
      description: 'Student moves patient without proper precautions',
      input: 'Can you stand up? Let\'s get you to the ambulance',
      shouldContain: []
    }
  ],

  expectedScoreMin: 0,
  expectedScoreMax: 59
};
