// services/scenarioEndingManager.js
const TextNormalizer = require('./utils/textNormalizer');

class ScenarioEndingManager {
  constructor() {
    this.TIME_LIMIT_MINUTES = 20;
    this.endingTriggers = {
      handover: [
        'handover', 'hand over', 'giving report', 'transfer of care', 
        'report to hospital', 'hospital report', 'giving handover',
        'ready to give handover', 'ready to give my report',
        'transferring care', 'handing over patient'
      ],
      manual: [
        'end scenario', 'finish scenario', 'complete scenario',
        'scenario complete', 'done with scenario', 'stop scenario'
      ]
    };
  }

  // Check if scenario should end based on user message
  checkForScenarioEnding(userMessage, conversationHistory, scenarioStartTime) {
    const normalizedMessage = TextNormalizer.normalizeToAsciiLower(userMessage);
    
    // Check for handover trigger
    if (this.isHandoverMessage(normalizedMessage)) {
      return {
        shouldEnd: true,
        reason: 'handover',
        trigger: 'User initiated handover report',
        timeSpent: this.calculateTimeSpent(scenarioStartTime)
      };
    }

    // Check for manual ending trigger
    if (this.isManualEndMessage(normalizedMessage)) {
      return {
        shouldEnd: true,
        reason: 'manual',
        trigger: 'User manually ended scenario',
        timeSpent: this.calculateTimeSpent(scenarioStartTime)
      };
    }

    // Check for time limit
    const timeSpent = this.calculateTimeSpent(scenarioStartTime);
    // Convert to milliseconds for more precise comparison
    const timeSpentMs = (Date.now() - scenarioStartTime);
    const timeLimitMs = this.TIME_LIMIT_MINUTES * 60 * 1000;
    
    console.log(`⏱️ Precise time check: ${timeSpentMs}ms elapsed of ${timeLimitMs}ms limit`);
    
    if (timeSpentMs >= timeLimitMs) {
      return {
        shouldEnd: true,
        reason: 'timeout',
        trigger: `Time limit reached (${this.TIME_LIMIT_MINUTES} minutes)`,
        timeSpent
      };
    }

    return {
      shouldEnd: false,
      timeSpent
    };
  }

  // Detect handover/report messages
  isHandoverMessage(normalizedMessage) {
    return this.endingTriggers.handover.some(trigger => {
      const normalizedTrigger = TextNormalizer.normalizeToAsciiLower(trigger);
      return normalizedMessage.includes(normalizedTrigger);
    });
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
      case 'handover':
        return this.generateHandoverResponse(userMessage, endingInfo.timeSpent);
      
      case 'manual':
        return this.generateManualEndResponse(endingInfo.timeSpent);
      
      case 'timeout':
        return this.generateTimeoutResponse();
      
      default:
        return 'Scenario ended.';
    }
  }

  // Generate response for handover-triggered ending
  generateHandoverResponse(userMessage, timeSpent) {
    // Extract the handover content from the user message
    const handoverContent = this.extractHandoverContent(userMessage);
    
    if (handoverContent) {
      return `Thank you for your handover report: "${handoverContent}"\n\n` +
             `Scenario completed in ${timeSpent} minutes.`;
    } else {
      return `Handover noted. Scenario completed in ${timeSpent} minutes.`;
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

  // Extract handover content from user message
  extractHandoverContent(userMessage) {
    // Look for common handover patterns and extract the report content
    const patterns = [
      /(?:handover|report|transfer).*?:\s*(.+)/i,
      /(?:ready to give|giving).*?(?:handover|report).*?(.+)/i,
      /transferring care.*?(.+)/i
    ];

    for (const pattern of patterns) {
      const match = userMessage.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // If no specific pattern found, check if the entire message is a handover
    if (this.isHandoverMessage(TextNormalizer.normalizeToAsciiLower(userMessage))) {
      // Return the message content after removing the handover trigger words
      let content = userMessage;
      this.endingTriggers.handover.forEach(trigger => {
        const regex = new RegExp(trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        content = content.replace(regex, '').trim();
      });
      
      // Clean up common prefixes
      content = content.replace(/^[:.\-\s]+/, '').trim();
      
      return content.length > 10 ? content : null;
    }

    return null;
  }

  // Check if handover contains required elements for grading
  analyzeHandoverQuality(handoverContent) {
    if (!handoverContent) {
      return {
        hasAge: false,
        hasChiefComplaint: false,
        hasFindings: false,
        hasVitals: false,
        hasTreatments: false,
        completenessScore: 0
      };
    }

    const content = handoverContent.toLowerCase();
    
    const analysis = {
      hasAge: /\b\d{1,3}\s*(?:year|yr|yo)\b/.test(content),
      hasChiefComplaint: /(complain|chief|presenting|symptoms?)/.test(content),
      hasFindings: /(found|noted|assessed|exam|physical)/.test(content),
      hasVitals: /(vital|bp|blood pressure|heart rate|pulse|temp|spo2|oxygen)/.test(content),
      hasTreatments: /(treatment|gave|administered|intervention|medication)/.test(content)
    };

    // Calculate completeness score (0-5 based on elements present)
    analysis.completenessScore = Object.values(analysis).filter(Boolean).length;

    return analysis;
  }

  // Generate feedback on handover quality
  generateHandoverFeedback(handoverAnalysis, handoverContent) {
    const feedback = [];
    
    if (handoverAnalysis.completenessScore === 0) {
      feedback.push('No handover content was detected.');
      return feedback;
    }

    // Positive feedback for included elements
    const positiveElements = [];
    if (handoverAnalysis.hasAge) positiveElements.push('patient age');
    if (handoverAnalysis.hasChiefComplaint) positiveElements.push('chief complaint');
    if (handoverAnalysis.hasFindings) positiveElements.push('assessment findings');
    if (handoverAnalysis.hasVitals) positiveElements.push('vital signs');
    if (handoverAnalysis.hasTreatments) positiveElements.push('treatments provided');

    if (positiveElements.length > 0) {
      feedback.push(`Handover included: ${positiveElements.join(', ')}`);
    }

    // Suggestions for missing elements
    const missingElements = [];
    if (!handoverAnalysis.hasAge) missingElements.push('patient age/demographics');
    if (!handoverAnalysis.hasChiefComplaint) missingElements.push('chief complaint');
    if (!handoverAnalysis.hasFindings) missingElements.push('assessment findings');
    if (!handoverAnalysis.hasVitals) missingElements.push('vital signs');
    if (!handoverAnalysis.hasTreatments) missingElements.push('treatments/interventions');

    if (missingElements.length > 0) {
      feedback.push(`Consider including: ${missingElements.join(', ')}`);
    }

    // Overall quality assessment
    if (handoverAnalysis.completenessScore >= 4) {
      feedback.push('Comprehensive handover report.');
    } else if (handoverAnalysis.completenessScore >= 2) {
      feedback.push('Adequate handover report with room for improvement.');
    } else {
      feedback.push('Handover report needs significant improvement.');
    }

    return feedback;
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

