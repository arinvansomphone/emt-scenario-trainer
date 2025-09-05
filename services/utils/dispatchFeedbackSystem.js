// services/utils/dispatchFeedbackSystem.js

/**
 * Dispatch Feedback System
 * Collects user feedback on dispatch messages and uses it to improve future generations
 */

class DispatchFeedbackSystem {
  constructor() {
    this.feedbackHistory = [];
    this.improvementPatterns = [];
    this.currentDispatch = null;
    this.feedbackSession = null;
  }

  /**
   * Start a new feedback session
   * @param {Object} dispatchData - The current dispatch data
   * @returns {Object} - Session information
   */
  startFeedbackSession(dispatchData) {
    this.currentDispatch = dispatchData;
    this.feedbackSession = {
      id: Date.now(),
      startTime: new Date(),
      dispatchData: dispatchData,
      feedback: [],
      improvements: [],
      status: 'active'
    };
    
    console.log('🔄 Started feedback session for dispatch:', dispatchData);
    return this.feedbackSession;
  }

  /**
   * Process user feedback on dispatch message
   * @param {string} userFeedback - User's feedback text
   * @returns {Object} - Processed feedback with suggestions
   */
  processFeedback(userFeedback) {
    if (!this.feedbackSession) {
      throw new Error('No active feedback session');
    }

    const feedback = {
      id: Date.now(),
      timestamp: new Date(),
      text: userFeedback,
      analysis: this.analyzeFeedback(userFeedback),
      suggestions: this.generateSuggestions(userFeedback)
    };

    this.feedbackSession.feedback.push(feedback);
    
    console.log('📝 Processed feedback:', feedback);
    return feedback;
  }

  /**
   * Analyze user feedback to extract improvement areas
   * @param {string} feedback - User feedback text
   * @returns {Object} - Analysis results
   */
  analyzeFeedback(feedback) {
    const analysis = {
      areas: [],
      sentiment: 'neutral',
      priority: 'medium',
      actionable: false
    };

    const feedbackLower = feedback.toLowerCase();

    // Detect improvement areas
    if (feedbackLower.includes('age') || feedbackLower.includes('old')) {
      analysis.areas.push('age_appropriateness');
    }
    if (feedbackLower.includes('gender') || feedbackLower.includes('male') || feedbackLower.includes('female')) {
      analysis.areas.push('gender_consistency');
    }
    if (feedbackLower.includes('location') || feedbackLower.includes('place')) {
      analysis.areas.push('location_specificity');
    }
    if (feedbackLower.includes('time') || feedbackLower.includes('when')) {
      analysis.areas.push('time_realism');
    }
    if (feedbackLower.includes('symptom') || feedbackLower.includes('medical') || feedbackLower.includes('condition')) {
      analysis.areas.push('medical_accuracy');
    }
    if (feedbackLower.includes('caller') || feedbackLower.includes('who called')) {
      analysis.areas.push('caller_info');
    }
    if (feedbackLower.includes('realistic') || feedbackLower.includes('believable')) {
      analysis.areas.push('overall_realism');
    }

    // Detect sentiment
    if (feedbackLower.includes('good') || feedbackLower.includes('great') || feedbackLower.includes('perfect')) {
      analysis.sentiment = 'positive';
    } else if (feedbackLower.includes('bad') || feedbackLower.includes('wrong') || feedbackLower.includes('terrible')) {
      analysis.sentiment = 'negative';
    }

    // Detect priority
    if (feedbackLower.includes('important') || feedbackLower.includes('critical') || feedbackLower.includes('major')) {
      analysis.priority = 'high';
    } else if (feedbackLower.includes('minor') || feedbackLower.includes('small')) {
      analysis.priority = 'low';
    }

    analysis.actionable = analysis.areas.length > 0;

    return analysis;
  }

  /**
   * Generate specific suggestions based on feedback
   * @param {string} feedback - User feedback text
   * @returns {Array} - Array of improvement suggestions
   */
  generateSuggestions(feedback) {
    const suggestions = [];
    const feedbackLower = feedback.toLowerCase();

    // Age-related suggestions
    if (feedbackLower.includes('age') || feedbackLower.includes('old')) {
      suggestions.push('Adjust age to be more appropriate for the scenario type');
      suggestions.push('Consider typical age ranges for this medical condition');
    }

    // Gender-related suggestions
    if (feedbackLower.includes('gender') || feedbackLower.includes('male') || feedbackLower.includes('female')) {
      suggestions.push('Ensure gender consistency throughout the dispatch');
      suggestions.push('Use gender-appropriate medical terminology');
    }

    // Location-related suggestions
    if (feedbackLower.includes('location') || feedbackLower.includes('place')) {
      suggestions.push('Make location more specific and realistic');
      suggestions.push('Consider typical locations where this emergency might occur');
    }

    // Time-related suggestions
    if (feedbackLower.includes('time') || feedbackLower.includes('when')) {
      suggestions.push('Use realistic time formats (e.g., "2:30 PM")');
      suggestions.push('Consider time-appropriate scenarios');
    }

    // Medical accuracy suggestions
    if (feedbackLower.includes('symptom') || feedbackLower.includes('medical')) {
      suggestions.push('Use proper medical dispatch terminology');
      suggestions.push('Ensure symptoms match the scenario type');
    }

    // General improvement suggestions
    if (feedbackLower.includes('realistic') || feedbackLower.includes('believable')) {
      suggestions.push('Make the entire scenario more realistic');
      suggestions.push('Consider real-world emergency dispatch patterns');
    }

    return suggestions;
  }

  /**
   * Generate improved dispatch based on feedback
   * @param {Object} originalDispatch - Original dispatch data
   * @param {Array} feedbackHistory - Array of feedback objects
   * @returns {Object} - Improved dispatch data
   */
  generateImprovedDispatch(originalDispatch, feedbackHistory) {
    const improvements = {
      age: originalDispatch.age,
      gender: originalDispatch.gender,
      location: originalDispatch.location,
      time: originalDispatch.time,
      symptoms: originalDispatch.symptoms,
      callerInfo: originalDispatch.callerInfo
    };

    // Apply feedback-based improvements
    feedbackHistory.forEach(feedback => {
      const analysis = feedback.analysis;
      
      analysis.areas.forEach(area => {
        switch (area) {
          case 'age_appropriateness':
            improvements.age = this.improveAge(originalDispatch.age, originalDispatch.symptoms);
            break;
          case 'gender_consistency':
            improvements.gender = this.improveGender(originalDispatch.gender, originalDispatch.symptoms);
            break;
          case 'location_specificity':
            improvements.location = this.improveLocation(originalDispatch.location);
            break;
          case 'time_realism':
            improvements.time = this.improveTime(originalDispatch.time);
            break;
          case 'medical_accuracy':
            improvements.symptoms = this.improveSymptoms(originalDispatch.symptoms);
            break;
        }
      });
    });

    return improvements;
  }

  /**
   * Improve age based on feedback
   * @param {string} currentAge - Current age
   * @param {string} symptoms - Current symptoms
   * @returns {string} - Improved age
   */
  improveAge(currentAge, symptoms) {
    const age = parseInt(currentAge);
    const symptomsLower = symptoms.toLowerCase();

    // Adjust age based on symptoms
    if (symptomsLower.includes('cardiac') || symptomsLower.includes('heart')) {
      return Math.max(45, Math.min(75, age)).toString();
    } else if (symptomsLower.includes('trauma') || symptomsLower.includes('accident')) {
      return Math.max(18, Math.min(50, age)).toString();
    } else if (symptomsLower.includes('neurologic') || symptomsLower.includes('stroke')) {
      return Math.max(40, Math.min(70, age)).toString();
    }

    return currentAge;
  }

  /**
   * Improve gender consistency
   * @param {string} currentGender - Current gender
   * @param {string} symptoms - Current symptoms
   * @returns {string} - Improved gender
   */
  improveGender(currentGender, symptoms) {
    const symptomsLower = symptoms.toLowerCase();
    
    // Check for gender-specific terms in symptoms
    const maleTerms = ['he', 'his', 'him', 'male'];
    const femaleTerms = ['she', 'her', 'female'];

    const hasMaleTerms = maleTerms.some(term => symptomsLower.includes(term));
    const hasFemaleTerms = femaleTerms.some(term => symptomsLower.includes(term));

    if (hasMaleTerms && currentGender !== 'male') {
      return 'male';
    } else if (hasFemaleTerms && currentGender !== 'female') {
      return 'female';
    }

    return currentGender;
  }

  /**
   * Improve location specificity
   * @param {string} currentLocation - Current location
   * @returns {string} - Improved location
   */
  improveLocation(currentLocation) {
    const specificLocations = [
      'shopping mall food court',
      'office building lobby',
      'residential home on Oak Street',
      'restaurant parking lot',
      'gym facility',
      'senior living facility',
      'community center',
      'public library',
      'apartment complex',
      'workplace break room'
    ];

    // If current location is too generic, pick a more specific one
    if (currentLocation.length < 20) {
      return specificLocations[Math.floor(Math.random() * specificLocations.length)];
    }

    return currentLocation;
  }

  /**
   * Improve time format
   * @param {string} currentTime - Current time
   * @returns {string} - Improved time
   */
  improveTime(currentTime) {
    const timeRegex = /^(1[0-2]|0?[1-9]):[0-5][0-9] (AM|PM)$/;
    
    if (!timeRegex.test(currentTime)) {
      const times = [
        '8:30 AM', '10:15 AM', '12:45 PM', '2:20 PM', 
        '4:10 PM', '6:30 PM', '8:45 PM', '11:20 PM'
      ];
      return times[Math.floor(Math.random() * times.length)];
    }

    return currentTime;
  }

  /**
   * Improve medical symptoms
   * @param {string} currentSymptoms - Current symptoms
   * @returns {string} - Improved symptoms
   */
  improveSymptoms(currentSymptoms) {
    const symptomsLower = currentSymptoms.toLowerCase();
    
    // Remove caller quotes if present
    const callerTerms = ['my dad', 'my mom', 'my husband', 'my wife', 'my brother', 'my sister'];
    if (callerTerms.some(term => symptomsLower.includes(term))) {
      // Replace with medical terminology
      if (symptomsLower.includes('confusion')) {
        return 'confusion and slurred speech';
      } else if (symptomsLower.includes('chest')) {
        return 'chest pain and shortness of breath';
      } else if (symptomsLower.includes('breathing')) {
        return 'difficulty breathing with wheezing';
      }
    }

    return currentSymptoms;
  }

  /**
   * End current feedback session and generate summary
   * @returns {Object} - Session summary with improvements
   */
  endFeedbackSession() {
    if (!this.feedbackSession) {
      throw new Error('No active feedback session');
    }

    this.feedbackSession.status = 'completed';
    this.feedbackSession.endTime = new Date();
    this.feedbackSession.duration = this.feedbackSession.endTime - this.feedbackSession.startTime;

    // Generate improvements based on feedback
    const improvedDispatch = this.generateImprovedDispatch(
      this.currentDispatch,
      this.feedbackSession.feedback
    );

    const summary = {
      sessionId: this.feedbackSession.id,
      originalDispatch: this.currentDispatch,
      improvedDispatch: improvedDispatch,
      feedbackCount: this.feedbackSession.feedback.length,
      improvements: this.feedbackSession.feedback.map(f => f.suggestions).flat(),
      duration: this.feedbackSession.duration
    };

    // Store in history
    this.feedbackHistory.push(summary);

    console.log('✅ Feedback session completed:', summary);
    return summary;
  }

  /**
   * Get feedback history for analysis
   * @returns {Array} - Array of feedback session summaries
   */
  getFeedbackHistory() {
    return this.feedbackHistory;
  }

  /**
   * Get improvement patterns from feedback history
   * @returns {Object} - Common improvement patterns
   */
  getImprovementPatterns() {
    const patterns = {
      ageIssues: 0,
      genderIssues: 0,
      locationIssues: 0,
      timeIssues: 0,
      medicalIssues: 0,
      totalSessions: this.feedbackHistory.length
    };

    this.feedbackHistory.forEach(session => {
      session.improvements.forEach(improvement => {
        if (improvement.includes('age')) patterns.ageIssues++;
        if (improvement.includes('gender')) patterns.genderIssues++;
        if (improvement.includes('location')) patterns.locationIssues++;
        if (improvement.includes('time')) patterns.timeIssues++;
        if (improvement.includes('medical')) patterns.medicalIssues++;
      });
    });

    return patterns;
  }
}

module.exports = DispatchFeedbackSystem;

