/**
 * Example: Manual Test Script
 * 
 * This shows how to manually test a scenario step-by-step.
 * Useful for debugging or creating new test scenarios.
 * 
 * Usage: node test/example-manual-test.js
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function runManualTest() {
  console.log('🧪 Running Manual Test\n');

  let sessionId = null;
  let conversation = [];

  const scenarioData = {
    sunetId: 'manual-test',
    mainScenario: 'Medical Scenario',
    subScenario: 'Cardiac Scenario'
  };

  // Step 1: Initial greeting
  console.log('Step 1: Greeting and scene safety');
  const step1 = await sendMessage(
    "Hi, I'm an EMT. Is the scene safe?",
    conversation,
    scenarioData,
    sessionId
  );
  
  sessionId = step1.sessionId;
  conversation = step1.conversation;
  console.log('Response:', step1.response);
  console.log('');

  // Step 2: Chief complaint
  console.log('Step 2: Ask chief complaint');
  const step2 = await sendMessage(
    "What's your chief complaint?",
    conversation,
    scenarioData,
    sessionId
  );
  
  conversation = step2.conversation;
  console.log('Response:', step2.response);
  console.log('');

  // Step 3: OPQRST - Onset
  console.log('Step 3: When did it start?');
  const step3 = await sendMessage(
    "When did this pain start?",
    conversation,
    scenarioData,
    sessionId
  );
  
  conversation = step3.conversation;
  console.log('Response:', step3.response);
  console.log('');

  // Step 4: OPQRST - Quality
  console.log('Step 4: Quality of pain');
  const step4 = await sendMessage(
    "What does the pain feel like?",
    conversation,
    scenarioData,
    sessionId
  );
  
  conversation = step4.conversation;
  console.log('Response:', step4.response);
  console.log('');

  // Step 5: Get score
  console.log('Step 5: Get final score');
  const score = await getScore(conversation, scenarioData, sessionId);
  console.log('Score:', score);
  console.log('Feedback:', score.feedback?.substring(0, 200) + '...');
  console.log('');

  console.log('✅ Manual test complete!');
}

async function sendMessage(message, conversation, scenarioData, sessionId) {
  try {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversation,
        scenarioData,
        sessionId
      })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Unknown error');
    }

    return {
      response: data.data.response,
      conversation: data.data.conversation,
      sessionId: data.data.sessionId
    };
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

async function getScore(conversation, scenarioData, sessionId) {
  try {
    const response = await fetch(`${API_URL}/api/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation,
        scenarioData,
        sessionId
      })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Unknown error');
    }

    return data.data;
  } catch (error) {
    console.error('Error getting score:', error.message);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  runManualTest().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { sendMessage, getScore };
