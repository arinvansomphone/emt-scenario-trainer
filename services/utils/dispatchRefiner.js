// services/utils/dispatchRefiner.js

/**
 * Dispatch Refinement Utility
 * Provides tools for improving and validating dispatch messages
 */

class DispatchRefiner {
  constructor() {
    this.qualityMetrics = {
      medicalAccuracy: 0,
      realism: 0,
      completeness: 0,
      consistency: 0
    };
  }

  /**
   * Analyze dispatch quality and provide improvement suggestions
   * @param {Object} dispatchData - The dispatch data to analyze
   * @param {string} scenarioType - The scenario type
   * @returns {Object} - Analysis results with suggestions
   */
  analyzeDispatchQuality(dispatchData, scenarioType) {
    const analysis = {
      score: 0,
      strengths: [],
      weaknesses: [],
      suggestions: [],
      medicalAccuracy: 0,
      realism: 0,
      completeness: 0,
      consistency: 0
    };

    // Check medical accuracy
    analysis.medicalAccuracy = this.checkMedicalAccuracy(dispatchData, scenarioType);
    
    // Check realism
    analysis.realism = this.checkRealism(dispatchData, scenarioType);
    
    // Check completeness
    analysis.completeness = this.checkCompleteness(dispatchData);
    
    // Check consistency
    analysis.consistency = this.checkConsistency(dispatchData);

    // Calculate overall score
    analysis.score = Math.round((analysis.medicalAccuracy + analysis.realism + analysis.completeness + analysis.consistency) / 4);

    // Generate suggestions based on weaknesses
    this.generateSuggestions(analysis, dispatchData, scenarioType);

    return analysis;
  }

  /**
   * Check medical accuracy of dispatch information
   * @param {Object} dispatchData - Dispatch data
   * @param {string} scenarioType - Scenario type
   * @returns {number} - Accuracy score (0-100)
   */
  checkMedicalAccuracy(dispatchData, scenarioType) {
    let score = 100;
    const symptoms = dispatchData.symptoms?.toLowerCase() || '';

    // Check for inappropriate medical terminology
    const inappropriateTerms = ['my dad', 'my mom', 'my husband', 'my wife'];
    if (inappropriateTerms.some(term => symptoms.includes(term))) {
      score -= 30;
    }

    // Check for appropriate symptoms for scenario type
    const scenarioTypeLower = scenarioType.toLowerCase();
    if (scenarioTypeLower.includes('cardiac')) {
      const cardiacTerms = ['chest pain', 'shortness of breath', 'chest discomfort', 'heart'];
      if (!cardiacTerms.some(term => symptoms.includes(term))) {
        score -= 20;
      }
    } else if (scenarioTypeLower.includes('neurologic')) {
      const neuroTerms = ['confusion', 'slurred speech', 'weakness', 'headache'];
      if (!neuroTerms.some(term => symptoms.includes(term))) {
        score -= 20;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Check realism of dispatch information
   * @param {Object} dispatchData - Dispatch data
   * @param {string} scenarioType - Scenario type
   * @returns {number} - Realism score (0-100)
   */
  checkRealism(dispatchData, scenarioType) {
    let score = 100;

    // Check age appropriateness
    const age = parseInt(dispatchData.age);
    const scenarioTypeLower = scenarioType.toLowerCase();
    
    if (scenarioTypeLower.includes('cardiac') && (age < 45 || age > 75)) {
      score -= 15;
    } else if (scenarioTypeLower.includes('trauma') && (age < 18 || age > 50)) {
      score -= 15;
    }

    // Check location specificity
    if (!dispatchData.location || dispatchData.location.length < 15) {
      score -= 10;
    }

    // Check time format
    const timeRegex = /^(1[0-2]|0?[1-9]):[0-5][0-9] (AM|PM)$/;
    if (!timeRegex.test(dispatchData.time)) {
      score -= 10;
    }

    return Math.max(0, score);
  }

  /**
   * Check completeness of dispatch information
   * @param {Object} dispatchData - Dispatch data
   * @returns {number} - Completeness score (0-100)
   */
  checkCompleteness(dispatchData) {
    let score = 100;
    const requiredFields = ['age', 'gender', 'location', 'time', 'symptoms', 'callerInfo'];
    
    requiredFields.forEach(field => {
      if (!dispatchData[field]) {
        score -= 15;
      }
    });

    return Math.max(0, score);
  }

  /**
   * Check consistency of dispatch information
   * @param {Object} dispatchData - Dispatch data
   * @returns {number} - Consistency score (0-100)
   */
  checkConsistency(dispatchData) {
    let score = 100;

    // Check for logical inconsistencies
    const symptoms = dispatchData.symptoms?.toLowerCase() || '';
    const gender = dispatchData.gender?.toLowerCase() || '';

    // Check for gender-specific terms that don't match gender
    if (gender === 'male' && symptoms.includes('pregnant')) {
      score -= 30;
    }

    return Math.max(0, score);
  }

  /**
   * Generate improvement suggestions
   * @param {Object} analysis - Analysis results
   * @param {Object} dispatchData - Dispatch data
   * @param {string} scenarioType - Scenario type
   */
  generateSuggestions(analysis, dispatchData, scenarioType) {
    if (analysis.medicalAccuracy < 80) {
      analysis.suggestions.push('Improve medical terminology - use professional dispatch language');
    }

    if (analysis.realism < 80) {
      analysis.suggestions.push('Enhance realism - check age appropriateness and location specificity');
    }

    if (analysis.completeness < 100) {
      analysis.suggestions.push('Ensure all required fields are present');
    }

    if (analysis.consistency < 100) {
      analysis.suggestions.push('Check for logical inconsistencies in the scenario');
    }

    // Scenario-specific suggestions
    const scenarioTypeLower = scenarioType.toLowerCase();
    if (scenarioTypeLower.includes('cardiac') && analysis.medicalAccuracy < 90) {
      analysis.suggestions.push('Include appropriate cardiac symptoms like chest pain or shortness of breath');
    }

    if (scenarioTypeLower.includes('neurologic') && analysis.medicalAccuracy < 90) {
      analysis.suggestions.push('Include appropriate neurologic symptoms like confusion or slurred speech');
    }
  }

  /**
   * Generate alternative dispatch variations
   * @param {Object} dispatchData - Original dispatch data
   * @param {string} scenarioType - Scenario type
   * @returns {Array} - Array of alternative dispatch variations
   */
  generateAlternatives(dispatchData, scenarioType) {
    const alternatives = [];
    
    // Variation 1: Different location
    alternatives.push({
      ...dispatchData,
      location: this.getAlternativeLocation(dispatchData.location, scenarioType)
    });

    // Variation 2: Different time
    alternatives.push({
      ...dispatchData,
      time: this.getAlternativeTime(dispatchData.time)
    });

    // Variation 3: Different caller
    alternatives.push({
      ...dispatchData,
      callerInfo: this.getAlternativeCaller(dispatchData.callerInfo)
    });

    return alternatives;
  }

  /**
   * Get alternative location
   * @param {string} currentLocation - Current location
   * @param {string} scenarioType - Scenario type
   * @returns {string} - Alternative location
   */
  getAlternativeLocation(currentLocation, scenarioType) {
    const locations = {
      'Cardiac Scenario': [
        'office building lobby',
        'shopping mall food court',
        'restaurant parking lot',
        'gym facility'
      ],
      'Neurologic Scenario': [
        'residential home on Oak Street',
        'senior living facility',
        'community center',
        'public library'
      ],
      'Respiratory Scenario': [
        'apartment complex',
        'workplace break room',
        'park bench',
        'bus stop'
      ]
    };

    const scenarioTypeLower = scenarioType.toLowerCase();
    const relevantLocations = locations[scenarioType] || locations['Cardiac Scenario'];
    
    return relevantLocations[Math.floor(Math.random() * relevantLocations.length)];
  }

  /**
   * Get alternative time
   * @param {string} currentTime - Current time
   * @returns {string} - Alternative time
   */
  getAlternativeTime(currentTime) {
    const times = [
      '8:30 AM', '10:15 AM', '12:45 PM', '2:20 PM', 
      '4:10 PM', '6:30 PM', '8:45 PM', '11:20 PM'
    ];
    
    return times[Math.floor(Math.random() * times.length)];
  }

  /**
   * Get alternative caller
   * @param {string} currentCaller - Current caller info
   * @returns {string} - Alternative caller info
   */
  getAlternativeCaller(currentCaller) {
    const callers = [
      'A coworker called 911 and is present on scene as well.',
      'A family member called 911 and is present on scene as well.',
      'A bystander called 911 and is present on scene as well.',
      'The patient called 911 themselves.'
    ];
    
    const filteredCallers = callers.filter(caller => caller !== currentCaller);
    return filteredCallers[Math.floor(Math.random() * filteredCallers.length)];
  }
}

module.exports = DispatchRefiner;

