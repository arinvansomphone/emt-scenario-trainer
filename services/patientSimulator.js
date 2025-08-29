// services/patientSimulator.js
const TextNormalizer = require('./utils/textNormalizer');

class PatientSimulator {
  constructor() {
    this.scenarioStartTime = null;
    this.scenarioTimer = null;
    this.maxScenarioTime = 15 * 60 * 1000; // 15 minutes in milliseconds
    this.vitalsHistory = [];
    this.interventionsPerformed = [];
    this.consciousnessLevel = 'alert'; // alert, altered, unconscious
    this.patientResponses = [];
  }

  /**
   * Initialize a new patient simulation
   * @param {Object} scenarioData - Complete scenario data
   * @returns {Object} - Initial patient state
   */
  initializePatient(scenarioData) {
    this.scenarioStartTime = Date.now();
    this.vitalsHistory = [];
    this.interventionsPerformed = [];
    this.patientResponses = [];
    
    // Set initial consciousness level from scenario
    this.consciousnessLevel = scenarioData?.generatedScenario?.physicalFindings?.consciousness || 'alert';
    
    // Initialize baseline vitals
    const baselineVitals = this.getBaselineVitals(scenarioData);
    this.vitalsHistory.push({
      timestamp: this.scenarioStartTime,
      vitals: baselineVitals,
      reason: 'baseline'
    });

    console.log('🏥 Patient simulator initialized');
    console.log('⏰ Scenario start time:', new Date(this.scenarioStartTime).toLocaleTimeString());
    console.log('💓 Baseline vitals:', baselineVitals);
    
    return {
      startTime: this.scenarioStartTime,
      consciousness: this.consciousnessLevel,
      vitals: baselineVitals
    };
  }

  /**
   * Get current scenario time elapsed in minutes
   * @returns {number} - Minutes elapsed since scenario start
   */
  getElapsedTime() {
    if (!this.scenarioStartTime) return 0;
    return Math.floor((Date.now() - this.scenarioStartTime) / 60000);
  }

  /**
   * Check if scenario time limit has been reached
   * @returns {boolean} - True if time limit exceeded
   */
  isTimeExpired() {
    if (!this.scenarioStartTime) return false;
    return (Date.now() - this.scenarioStartTime) > this.maxScenarioTime;
  }

  /**
   * Get remaining scenario time in minutes
   * @returns {number} - Minutes remaining
   */
  getRemainingTime() {
    if (!this.scenarioStartTime) return 15;
    const elapsed = Date.now() - this.scenarioStartTime;
    const remaining = Math.max(0, this.maxScenarioTime - elapsed);
    return Math.ceil(remaining / 60000);
  }

  /**
   * Get baseline vitals based on scenario type and difficulty
   * @param {Object} scenarioData - Scenario data
   * @returns {Object} - Baseline vital signs
   */
  getBaselineVitals(scenarioData) {
    const difficulty = scenarioData?.generatedScenario?.difficulty?.level || 'intermediate';
    const scenarioType = this.determineScenarioType(scenarioData);
    
    // Get base vitals from scenario if available
    const scenarioVitals = scenarioData?.generatedScenario?.vitals?.baseline;
    if (scenarioVitals) {
      return {
        heartRate: scenarioVitals.heartRate || 90,
        respiratoryRate: scenarioVitals.respiratoryRate || 18,
        systolic: scenarioVitals.bloodPressureSystolic || 130,
        diastolic: scenarioVitals.bloodPressureDiastolic || 80,
        temperature: scenarioVitals.temperature || 98.6,
        spO2: scenarioVitals.spO2 || 96
      };
    }

    // Fallback to category-based vitals
    return this.getVitalsByCategory(scenarioType, difficulty);
  }

  /**
   * Determine scenario type from scenario data
   * @param {Object} scenarioData - Scenario data
   * @returns {string} - Scenario category
   */
  determineScenarioType(scenarioData) {
    const mainScenario = scenarioData?.mainScenario?.toLowerCase() || '';
    const subScenario = scenarioData?.subScenario?.toLowerCase() || '';
    
    if (mainScenario.includes('trauma')) return 'trauma';
    if (subScenario.includes('cardiac') || subScenario.includes('chest pain')) return 'cardiac';
    if (subScenario.includes('respiratory') || subScenario.includes('breathing')) return 'respiratory';
    if (subScenario.includes('neurologic') || subScenario.includes('stroke')) return 'neurologic';
    if (subScenario.includes('metabolic') || subScenario.includes('diabetic')) return 'metabolic';
    if (subScenario.includes('allergic') || subScenario.includes('anaphylaxis')) return 'allergic';
    
    return 'general';
  }

  /**
   * Get vitals by category and difficulty
   * @param {string} category - Scenario category
   * @param {string} difficulty - Difficulty level
   * @returns {Object} - Vital signs
   */
  getVitalsByCategory(category, difficulty) {
    const baseVitals = {
      cardiac: { heartRate: 110, respiratoryRate: 20, systolic: 160, diastolic: 95, spO2: 92, temperature: 98.6 },
      respiratory: { heartRate: 88, respiratoryRate: 24, systolic: 140, diastolic: 85, spO2: 89, temperature: 98.6 },
      trauma: { heartRate: 105, respiratoryRate: 22, systolic: 145, diastolic: 88, spO2: 95, temperature: 98.6 },
      neurologic: { heartRate: 85, respiratoryRate: 16, systolic: 130, diastolic: 80, spO2: 97, temperature: 98.6 },
      metabolic: { heartRate: 95, respiratoryRate: 18, systolic: 135, diastolic: 82, spO2: 94, temperature: 98.6 },
      allergic: { heartRate: 120, respiratoryRate: 26, systolic: 100, diastolic: 60, spO2: 88, temperature: 98.6 },
      general: { heartRate: 90, respiratoryRate: 18, systolic: 130, diastolic: 80, spO2: 96, temperature: 98.6 }
    };

    let vitals = { ...baseVitals[category] || baseVitals.general };

    // Apply difficulty modifiers
    switch (difficulty) {
      case 'novice':
        vitals.spO2 = Math.max(vitals.spO2, 90);
        vitals.heartRate = Math.min(vitals.heartRate, 115);
        break;
      case 'advanced':
        vitals.spO2 = Math.min(vitals.spO2, 85);
        vitals.heartRate = Math.max(vitals.heartRate, 105);
        vitals.respiratoryRate = Math.max(vitals.respiratoryRate, 24);
        break;
    }

    return vitals;
  }

  /**
   * Record an intervention performed by the EMT
   * @param {string} intervention - Description of intervention
   * @param {number} timestamp - When intervention was performed
   */
  recordIntervention(intervention, timestamp = Date.now()) {
    this.interventionsPerformed.push({
      intervention,
      timestamp,
      elapsedTime: Math.floor((timestamp - this.scenarioStartTime) / 60000)
    });
    
    console.log('💉 Intervention recorded:', intervention);
    
    // Update vitals based on intervention
    this.updateVitalsForIntervention(intervention, timestamp);
  }

  /**
   * Update vital signs based on intervention performed
   * @param {string} intervention - Intervention performed
   * @param {number} timestamp - When intervention was performed
   */
  updateVitalsForIntervention(intervention, timestamp) {
    const currentVitals = this.getCurrentVitals();
    const newVitals = { ...currentVitals };
    const normalizedIntervention = intervention.toLowerCase();

    // Oxygen therapy
    if (/(oxygen|o2|nasal cannula|nc|mask|bvm|bag valve)/.test(normalizedIntervention)) {
      newVitals.spO2 = Math.min(100, newVitals.spO2 + 3);
      newVitals.respiratoryRate = Math.max(12, newVitals.respiratoryRate - 2);
    }

    // Aspirin
    if (/(aspirin|asa)/.test(normalizedIntervention)) {
      newVitals.heartRate = Math.max(60, newVitals.heartRate - 5);
    }

    // Albuterol
    if (/(albuterol|ventolin|nebulizer|inhaler)/.test(normalizedIntervention)) {
      newVitals.respiratoryRate = Math.max(12, newVitals.respiratoryRate - 4);
      newVitals.spO2 = Math.min(100, newVitals.spO2 + 4);
      newVitals.heartRate = Math.min(150, newVitals.heartRate + 8); // Side effect
    }

    // Positioning
    if (/(sit.*up|upright|position|fowler)/.test(normalizedIntervention)) {
      newVitals.respiratoryRate = Math.max(12, newVitals.respiratoryRate - 2);
      newVitals.spO2 = Math.min(100, newVitals.spO2 + 2);
    }

    // IV fluids
    if (/(iv|intravenous|fluid|saline)/.test(normalizedIntervention)) {
      newVitals.systolic = Math.min(180, newVitals.systolic + 5);
      newVitals.heartRate = Math.max(60, newVitals.heartRate - 3);
    }

    // Epinephrine
    if (/(epi|epinephrine|auto.*injector)/.test(normalizedIntervention)) {
      newVitals.heartRate = Math.min(150, newVitals.heartRate + 15);
      newVitals.systolic = Math.min(200, newVitals.systolic + 20);
      newVitals.spO2 = Math.min(100, newVitals.spO2 + 5);
      newVitals.respiratoryRate = Math.max(12, newVitals.respiratoryRate - 3);
    }

    // Record the new vitals
    this.vitalsHistory.push({
      timestamp,
      vitals: newVitals,
      reason: `intervention: ${intervention}`
    });
  }

  /**
   * Update vitals based on time progression and scenario evolution
   * @param {Object} scenarioData - Current scenario data
   */
  updateVitalsForTimeProgression(scenarioData) {
    const elapsedMinutes = this.getElapsedTime();
    const currentVitals = this.getCurrentVitals();
    const newVitals = { ...currentVitals };
    const scenarioType = this.determineScenarioType(scenarioData);
    const difficulty = scenarioData?.generatedScenario?.difficulty?.level || 'intermediate';

    // Check if critical interventions are missing
    const criticalInterventions = this.getCriticalInterventions(scenarioType);
    const providedInterventions = this.interventionsPerformed.map(i => i.intervention.toLowerCase());
    const missingCritical = criticalInterventions.filter(critical => 
      !providedInterventions.some(provided => provided.includes(critical))
    );

    // Deterioration based on missing critical interventions and time
    if (missingCritical.length > 0 && elapsedMinutes > 5) {
      const deteriorationFactor = Math.min(elapsedMinutes / 10, 1.0);
      
      switch (scenarioType) {
        case 'cardiac':
          if (missingCritical.includes('oxygen')) {
            newVitals.spO2 = Math.max(75, newVitals.spO2 - (2 * deteriorationFactor));
          }
          if (missingCritical.includes('aspirin')) {
            newVitals.heartRate = Math.min(140, newVitals.heartRate + (5 * deteriorationFactor));
          }
          break;
        case 'respiratory':
          if (missingCritical.includes('oxygen')) {
            newVitals.spO2 = Math.max(70, newVitals.spO2 - (3 * deteriorationFactor));
            newVitals.respiratoryRate = Math.min(35, newVitals.respiratoryRate + (3 * deteriorationFactor));
          }
          break;
        case 'allergic':
          if (missingCritical.includes('epinephrine')) {
            newVitals.spO2 = Math.max(65, newVitals.spO2 - (4 * deteriorationFactor));
            newVitals.systolic = Math.max(70, newVitals.systolic - (10 * deteriorationFactor));
          }
          break;
      }
    }

    // Natural progression based on difficulty
    if (difficulty === 'advanced' && elapsedMinutes > 8) {
      // Advanced scenarios may deteriorate even with proper care
      newVitals.heartRate = Math.min(130, newVitals.heartRate + 2);
      newVitals.respiratoryRate = Math.min(28, newVitals.respiratoryRate + 1);
    }

    // Record updated vitals if they changed significantly
    if (this.vitalsChangedSignificantly(currentVitals, newVitals)) {
      this.vitalsHistory.push({
        timestamp: Date.now(),
        vitals: newVitals,
        reason: `time progression: ${elapsedMinutes} minutes`
      });
    }
  }

  /**
   * Get critical interventions for scenario type
   * @param {string} scenarioType - Type of scenario
   * @returns {Array} - List of critical interventions
   */
  getCriticalInterventions(scenarioType) {
    const criticalMap = {
      cardiac: ['oxygen', 'aspirin'],
      respiratory: ['oxygen', 'positioning'],
      allergic: ['epinephrine', 'oxygen'],
      trauma: ['oxygen', 'immobilization'],
      neurologic: ['oxygen', 'positioning'],
      metabolic: ['glucose', 'oxygen'],
      general: ['oxygen']
    };
    
    return criticalMap[scenarioType] || criticalMap.general;
  }

  /**
   * Check if vitals changed significantly enough to record
   * @param {Object} oldVitals - Previous vitals
   * @param {Object} newVitals - New vitals
   * @returns {boolean} - True if significant change
   */
  vitalsChangedSignificantly(oldVitals, newVitals) {
    const thresholds = {
      heartRate: 5,
      respiratoryRate: 2,
      systolic: 10,
      diastolic: 5,
      spO2: 2,
      temperature: 0.5
    };

    return Object.keys(thresholds).some(key => 
      Math.abs(oldVitals[key] - newVitals[key]) >= thresholds[key]
    );
  }

  /**
   * Get current vital signs
   * @returns {Object} - Current vital signs
   */
  getCurrentVitals() {
    if (this.vitalsHistory.length === 0) {
      return { heartRate: 90, respiratoryRate: 18, systolic: 130, diastolic: 80, spO2: 96, temperature: 98.6 };
    }
    return { ...this.vitalsHistory[this.vitalsHistory.length - 1].vitals };
  }

  /**
   * Get specific vital sign requested by EMT
   * @param {string} vitalType - Type of vital requested
   * @returns {string} - Formatted vital sign response
   */
  getSpecificVital(vitalType) {
    const currentVitals = this.getCurrentVitals();
    const normalizedType = vitalType.toLowerCase();

    if (/(heart rate|pulse|hr)/.test(normalizedType)) {
      return `Heart rate: ${currentVitals.heartRate} bpm`;
    }
    if (/(respiratory rate|breathing|rr|respiration)/.test(normalizedType)) {
      return `Respiratory rate: ${currentVitals.respiratoryRate} per minute`;
    }
    if (/(blood pressure|bp)/.test(normalizedType)) {
      return `Blood pressure: ${currentVitals.systolic}/${currentVitals.diastolic} mmHg`;
    }
    if (/(oxygen saturation|pulse ox|spo2|o2 sat)/.test(normalizedType)) {
      return `Oxygen saturation: ${currentVitals.spO2}%`;
    }
    if (/(temperature|temp)/.test(normalizedType)) {
      return `Temperature: ${currentVitals.temperature.toFixed(1)}°F`;
    }

    return `Please specify which vital sign you'd like to check.`;
  }

  /**
   * Update consciousness level based on scenario progression
   * @param {Object} scenarioData - Current scenario data
   */
  updateConsciousness(scenarioData) {
    const elapsedMinutes = this.getElapsedTime();
    const currentVitals = this.getCurrentVitals();
    const difficulty = scenarioData?.generatedScenario?.difficulty?.level || 'intermediate';

    // Consciousness changes based on vitals and time
    if (currentVitals.spO2 < 80 || currentVitals.systolic < 80) {
      if (this.consciousnessLevel === 'alert') {
        this.consciousnessLevel = 'altered';
      } else if (this.consciousnessLevel === 'altered' && currentVitals.spO2 < 75) {
        this.consciousnessLevel = 'unconscious';
      }
    }

    // Recovery with proper interventions
    const hasOxygen = this.interventionsPerformed.some(i => 
      /(oxygen|o2|nasal cannula|mask|bvm)/.test(i.intervention.toLowerCase())
    );
    
    if (hasOxygen && currentVitals.spO2 > 90 && this.consciousnessLevel === 'altered') {
      this.consciousnessLevel = 'alert';
    }
  }

  /**
   * Generate patient response based on consciousness level and question
   * @param {string} question - Question asked by EMT
   * @param {Object} scenarioData - Current scenario data
   * @returns {string} - Patient response
   */
  generatePatientResponse(question, scenarioData) {
    const normalizedQuestion = question.toLowerCase();
    
    switch (this.consciousnessLevel) {
      case 'unconscious':
        return 'The patient is unresponsive.';
      
      case 'altered':
        if (/(name|who are you)/.test(normalizedQuestion)) {
          return 'I... I think... what happened?';
        }
        if (/(pain|hurt)/.test(normalizedQuestion)) {
          return 'Everything hurts... I can\'t think straight.';
        }
        if (/(where|location)/.test(normalizedQuestion)) {
          return 'I don\'t know... where am I?';
        }
        return 'I\'m confused... what\'s happening?';
      
      case 'alert':
      default:
        return this.generateAlertPatientResponse(normalizedQuestion, scenarioData);
    }
  }

  /**
   * Generate response for alert patient
   * @param {string} normalizedQuestion - Normalized question
   * @param {Object} scenarioData - Current scenario data
   * @returns {string} - Patient response
   */
  generateAlertPatientResponse(normalizedQuestion, scenarioData) {
    const presentation = scenarioData?.generatedScenario?.presentation;
    const patientProfile = scenarioData?.generatedScenario?.patientProfile;
    
    if (/(name|who are you)/.test(normalizedQuestion)) {
      return 'My name is John Smith.'; // Generic name for simulation
    }
    
    if (/(age|old)/.test(normalizedQuestion)) {
      const age = patientProfile?.age || 45;
      return `I'm ${age} years old.`;
    }
    
    if (/(pain|hurt|feel)/.test(normalizedQuestion)) {
      const complaint = presentation?.chiefComplaint || 'chest pain';
      const severity = presentation?.severity || 'moderate';
      return `I have ${severity} ${complaint}.`;
    }
    
    if (/(when|start|began)/.test(normalizedQuestion)) {
      const onset = presentation?.onsetTime || '30 minutes ago';
      return `It started ${onset}.`;
    }
    
    if (/(medication|pills|drugs)/.test(normalizedQuestion)) {
      const meds = patientProfile?.medications || ['none'];
      if (meds.length === 1 && meds[0] === 'none') {
        return 'I don\'t take any medications.';
      }
      return `I take ${meds.join(', ')}.`;
    }
    
    if (/(allerg)/.test(normalizedQuestion)) {
      const allergies = patientProfile?.allergies || ['none'];
      if (allergies.length === 1 && allergies[0] === 'none') {
        return 'I don\'t have any known allergies.';
      }
      return `I'm allergic to ${allergies.join(', ')}.`;
    }
    
    if (/(history|medical|condition)/.test(normalizedQuestion)) {
      const history = patientProfile?.medicalHistory || ['none'];
      if (history.length === 1 && history[0] === 'none') {
        return 'I don\'t have any significant medical history.';
      }
      return `I have a history of ${history.join(', ')}.`;
    }
    
    return 'I\'m not sure about that. Can you help me?';
  }

  /**
   * Check if scenario should end (time expired or handover given)
   * @param {string} userMessage - Latest user message
   * @returns {Object} - End scenario result
   */
  checkScenarioEnd(userMessage) {
    const timeExpired = this.isTimeExpired();
    const handoverGiven = this.isHandoverReport(userMessage);
    
    if (timeExpired || handoverGiven) {
      return {
        shouldEnd: true,
        reason: timeExpired ? 'time_expired' : 'handover_complete',
        elapsedTime: this.getElapsedTime(),
        interventions: this.interventionsPerformed,
        finalVitals: this.getCurrentVitals()
      };
    }
    
    return { shouldEnd: false };
  }

  /**
   * Check if user message contains handover report
   * @param {string} message - User message
   * @returns {boolean} - True if handover report detected
   */
  isHandoverReport(message) {
    const normalized = message.toLowerCase();
    return /(handover|hand over|report|transport.*decision|my.*assessment|final.*report)/.test(normalized);
  }

  /**
   * Update vitals based on time progression and interventions
   */
  updateVitals() {
    if (!this.scenarioStartTime) return;
    
    const elapsedMinutes = this.getElapsedTime();
    const updatedVitals = this.calculateVitalsProgression(elapsedMinutes);
    
    this.vitalsHistory.push({
      timestamp: Date.now(),
      vitals: updatedVitals,
      elapsedTime: elapsedMinutes
    });
    
    console.log('📊 Vitals updated:', updatedVitals);
  }

  /**
   * Update consciousness level based on condition and interventions
   */
  updateConsciousness() {
    if (!this.scenarioStartTime) return;
    
    const currentVitals = this.getCurrentVitals();
    const elapsedMinutes = this.getElapsedTime();
    
    // Determine consciousness based on vitals and time
    if (currentVitals.spO2 < 80 || currentVitals.systolic < 80) {
      this.consciousnessLevel = 'altered';
    } else if (currentVitals.spO2 < 70 || currentVitals.systolic < 70) {
      this.consciousnessLevel = 'unconscious';
    } else if (elapsedMinutes > 10 && this.interventionsPerformed.length === 0) {
      this.consciousnessLevel = 'altered'; // Deterioration without treatment
    } else {
      this.consciousnessLevel = 'alert';
    }
    
    console.log('🧠 Consciousness updated:', this.consciousnessLevel);
  }

  /**
   * Check if scenario should end
   */
  shouldEndScenario() {
    if (!this.scenarioStartTime) return false;
    
    const elapsedMinutes = this.getElapsedTime();
    return elapsedMinutes >= 15; // 15-minute time limit
  }

  /**
   * Reset the patient simulator for a new scenario
   */
  reset() {
    this.scenarioStartTime = null;
    this.scenarioTimer = null;
    this.vitalsHistory = [];
    this.interventionsPerformed = [];
    this.consciousnessLevel = 'alert';
    this.patientResponses = [];
    
    console.log('🔄 Patient simulator reset');
  }
}

module.exports = PatientSimulator;
