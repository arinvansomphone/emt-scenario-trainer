// services/scenarioEndingManager.js
const TextNormalizer = require('./utils/textNormalizer');

class ScenarioEndingManager {
  constructor() {
    this.TIME_LIMIT_MINUTES = 20;
    // Handover ending removed - scenarios only end via button or timeout
    this.endingTriggers = {
      manual: [
        'end scenario', 'finish scenario', 'complete scenario',
        'scenario complete', 'done with scenario', 'stop scenario'
      ]
    };
  }

  // Check if scenario should end based on user message
  checkForScenarioEnding(userMessage, conversationHistory, scenarioStartTime) {
    const normalizedMessage = TextNormalizer.normalizeToAsciiLower(userMessage);
    
    // Handover ending removed - only check for manual end or timeout

    // Check for manual ending trigger
    if (this.isManualEndMessage(normalizedMessage)) {
      return {
        shouldEnd: true,
        reason: 'manual',
        trigger: 'User manually ended scenario',
        timeSpent: this.calculateTimeSpent(scenarioStartTime)
      };
    }

    // Time limit disabled
    const timeSpent = this.calculateTimeSpent(scenarioStartTime);
    return {
      shouldEnd: false,
      timeSpent
    };
  }

  // Detect manual ending messages
  isManualEndMessage(normalizedMessage) {
    // Also check for test command "force end test"
    if (/force\s+end\s+test/.test(normalizedMessage)) {
      return true;
    }
    return this.endingTriggers.manual.some(trigger => {
      const normalizedTrigger = TextNormalizer.normalizeToAsciiLower(trigger);
      return normalizedMessage.includes(normalizedTrigger);
    });
  }

  // Calculate time spent in minutes
  calculateTimeSpent(scenarioStartTime) {
    if (!scenarioStartTime) return 0;
    const currentTime = Date.now();
    const timeSpentMs = currentTime - scenarioStartTime;
    // Use floor to avoid rounding down early; ensures strict timeout at N minutes
    const minutes = Math.floor(timeSpentMs / (1000 * 60));
    console.log(`⏱️ Time check: ${minutes} minutes elapsed of ${this.TIME_LIMIT_MINUTES} limit (${timeSpentMs}ms)`);
    return minutes;
  }

  // Generate scenario ending response based on trigger type
  generateEndingResponse(endingInfo, userMessage) {
    switch (endingInfo.reason) {
      case 'manual':
        return this.generateManualEndResponse(endingInfo.timeSpent);
      
      case 'timeout':
        return this.generateTimeoutResponse();
      
      default:
        return 'Scenario ended.';
    }
  }

  // Generate response for manual ending
  generateManualEndResponse(timeSpent) {
    return `Scenario manually ended after ${timeSpent} minutes.`;
  }

  // Generate response for timeout ending
  generateTimeoutResponse() {
    return `Time limit reached (${this.TIME_LIMIT_MINUTES} minutes). Scenario automatically ended.`;
  }

  // Check if scenario is ready to end (used for warnings)
  checkForEndingWarning(timeSpent) {
    // Time warnings disabled
    return { showWarning: false };
  }

  // Format time for display
  formatTime(minutes) {
    if (minutes < 1) return 'less than 1 minute';
    if (minutes === 1) return '1 minute';
    return `${minutes} minutes`;
  }
}

module.exports = new ScenarioEndingManager();

