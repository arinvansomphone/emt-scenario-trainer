// services/actionRecognizer.js
const TextNormalizer = require('./utils/textNormalizer');

class ActionRecognizer {
  constructor() {
    this.medicalTerms = this.initializeMedicalTerms();
    this.actionPatterns = this.initializeActionPatterns();
  }

  /**
   * Initialize medical terminology dictionary
   * @returns {Object} - Medical terms and their variations
   */
  initializeMedicalTerms() {
    return {
      // Vital signs
      vitals: {
        heartRate: ['heart rate', 'hr', 'pulse', 'beats per minute', 'bpm'],
        respiratoryRate: ['respiratory rate', 'rr', 'breathing rate', 'respirations', 'breaths per minute'],
        bloodPressure: ['blood pressure', 'bp', 'systolic', 'diastolic'],
        oxygenSaturation: ['oxygen saturation', 'pulse ox', 'pulse oximeter', 'spo2', 'o2 sat', 'sat'],
        temperature: ['temperature', 'temp', 'fever']
      },
      
      // Equipment
      equipment: {
        oxygen: ['oxygen', 'o2', 'nasal cannula', 'nc', 'non-rebreather', 'nrb', 'bag valve mask', 'bvm', 'mask'],
        monitor: ['monitor', 'cardiac monitor', 'pulse oximeter', 'bp cuff', 'blood pressure cuff'],
        airway: ['airway', 'opa', 'npa', 'oral airway', 'nasal airway', 'suction'],
        immobilization: ['c-collar', 'cervical collar', 'backboard', 'spine board', 'splint', 'immobilize'],
        iv: ['iv', 'intravenous', 'saline', 'normal saline', 'fluid', 'line']
      },
      
      // Medications
      medications: {
        aspirin: ['aspirin', 'asa', 'baby aspirin'],
        albuterol: ['albuterol', 'ventolin', 'nebulizer', 'inhaler', 'bronchodilator'],
        epinephrine: ['epinephrine', 'epi', 'epi-pen', 'auto-injector'],
        glucose: ['glucose', 'oral glucose', 'sugar', 'dextrose'],
        nitroglycerin: ['nitroglycerin', 'nitro', 'sublingual']
      },
      
      // Assessment actions
      assessment: {
        inspect: ['inspect', 'look at', 'examine', 'observe', 'check', 'assess'],
        palpate: ['palpate', 'feel', 'press', 'touch', 'check for'],
        auscultate: ['listen', 'auscultate', 'lung sounds', 'heart sounds', 'bowel sounds']
      },
      
      // Body regions
      bodyRegions: {
        head: ['head', 'skull', 'face', 'scalp'],
        neck: ['neck', 'cervical', 'throat', 'c-spine'],
        chest: ['chest', 'thorax', 'ribs', 'sternum', 'lungs'],
        abdomen: ['abdomen', 'stomach', 'belly', 'abdominal'],
        pelvis: ['pelvis', 'pelvic', 'hip'],
        back: ['back', 'spine', 'spinal', 'lumbar'],
        upperExtremities: ['arm', 'arms', 'shoulder', 'elbow', 'wrist', 'hand', 'fingers'],
        lowerExtremities: ['leg', 'legs', 'thigh', 'knee', 'ankle', 'foot', 'toes']
      }
    };
  }

  /**
   * Initialize action recognition patterns
   * @returns {Object} - Action patterns and their handlers
   */
  initializeActionPatterns() {
    return {
      vitalCheck: {
        patterns: [
          /check\s+(.*?)\s*(vital|pulse|bp|heart rate|breathing|temperature|oxygen)/i,
          /take\s+(.*?)\s*(vital|pulse|bp|heart rate|breathing|temperature|oxygen)/i,
          /measure\s+(.*?)\s*(vital|pulse|bp|heart rate|breathing|temperature|oxygen)/i,
          /get\s+(.*?)\s*(vital|pulse|bp|heart rate|breathing|temperature|oxygen)/i,
          /(pulse|bp|heart rate|breathing|temperature|oxygen|vital)/i
        ],
        priority: 1
      },
      
      medicationAdmin: {
        patterns: [
          /give\s+(.*?)\s*(mg|mcg|units|tablet|dose)/i,
          /administer\s+(.*?)\s*(mg|mcg|units|tablet|dose)/i,
          /provide\s+(.*?)\s*(mg|mcg|units|tablet|dose)/i,
          /(aspirin|albuterol|epinephrine|glucose|nitro)/i
        ],
        priority: 2
      },
      
      equipmentUse: {
        patterns: [
          /apply\s+(.*?)\s*(oxygen|o2|mask|cannula|collar|monitor)/i,
          /place\s+(.*?)\s*(oxygen|o2|mask|cannula|collar|monitor)/i,
          /put\s+(.*?)\s*on\s+(oxygen|o2|mask|cannula|collar|monitor)/i,
          /start\s+(.*?)\s*(oxygen|o2|iv|saline)/i,
          /grab\s+(.*?)\s*(equipment|bag|monitor|oxygen)/i
        ],
        priority: 2
      },
      
      physicalAssessment: {
        patterns: [
          /(inspect|examine|look at|check)\s+(.*?)\s*(head|neck|chest|abdomen|back|arm|leg|airway|mouth)/i,
          /(palpate|feel|press)\s+(.*?)\s*(head|neck|chest|abdomen|back|arm|leg)/i,
          /(listen|auscultate)\s+(.*?)\s*(lung|heart|bowel|chest)/i,
          /(check|assess|inspect)\s+(the\s+)?airway/i,
          /(open\s+(?:your|the)\s+mouth).*(?:check|airway|inspect)/i,
          /physical\s+(exam|assessment)/i,
          /secondary\s+(exam|assessment)/i
        ],
        priority: 3
      },
      
      positioning: {
        patterns: [
          /position\s+(.*?)\s*(upright|sitting|supine|side|recovery)/i,
          /sit\s+(.*?)\s*up/i,
          /place\s+(.*?)\s*in\s+(.*?)\s*position/i,
          /fowler/i,
          /trendelenburg/i
        ],
        priority: 2
      },
      
      transportDecision: {
        patterns: [
          /transport\s+(.*?)\s*(code|priority)/i,
          /my\s+transport\s+decision/i,
          /(code\s*[123]|priority\s*[123])/i,
          /transport\s+to\s+(hospital|ed|er)/i
        ],
        priority: 1
      }
    };
  }

  /**
   * Recognize and parse user action from message
   * @param {string} userMessage - User's message
   * @returns {Object} - Parsed action with details
   */
  recognizeAction(userMessage) {
    const normalized = TextNormalizer.normalizeToAsciiLower(userMessage);
    
    // Try to match against action patterns
    const recognizedActions = [];
    
    Object.entries(this.actionPatterns).forEach(([actionType, config]) => {
      config.patterns.forEach(pattern => {
        const match = normalized.match(pattern);
        if (match) {
          recognizedActions.push({
            type: actionType,
            priority: config.priority,
            match: match[0],
            details: this.extractActionDetails(actionType, match, normalized)
          });
        }
      });
    });

    // Sort by priority and return the best match
    if (recognizedActions.length > 0) {
      recognizedActions.sort((a, b) => a.priority - b.priority);
      return recognizedActions[0];
    }

    // If no specific pattern matched, try general medical term recognition
    return this.recognizeGeneralMedicalAction(normalized, userMessage);
  }

  /**
   * Extract specific details from recognized action
   * @param {string} actionType - Type of action recognized
   * @param {Array} match - Regex match results
   * @param {string} normalized - Normalized message
   * @returns {Object} - Action details
   */
  extractActionDetails(actionType, match, normalized) {
    const details = { actionType, originalMatch: match[0] };

    switch (actionType) {
      case 'vitalCheck':
        details.vitalType = this.identifyVitalType(normalized);
        details.bodyRegion = this.identifyBodyRegion(normalized);
        break;
        
      case 'medicationAdmin':
        details.medication = this.identifyMedication(normalized);
        details.dosage = this.extractDosage(normalized);
        details.route = this.extractRoute(normalized);
        break;
        
      case 'equipmentUse':
        details.equipment = this.identifyEquipment(normalized);
        details.application = this.extractApplication(normalized);
        break;
        
      case 'physicalAssessment':
        details.assessmentType = this.identifyAssessmentType(normalized);
        details.bodyRegion = this.identifyBodyRegion(normalized);
        break;
        
      case 'positioning':
        details.position = this.identifyPosition(normalized);
        break;
        
      case 'transportDecision':
        details.priority = this.extractTransportPriority(normalized);
        details.destination = this.extractDestination(normalized);
        details.reason = this.extractTransportReason(normalized);
        break;
    }

    return details;
  }

  /**
   * Identify vital sign type from message
   * @param {string} normalized - Normalized message
   * @returns {string} - Vital sign type
   */
  identifyVitalType(normalized) {
    for (const [vitalType, terms] of Object.entries(this.medicalTerms.vitals)) {
      if (terms.some(term => normalized.includes(term))) {
        return vitalType;
      }
    }
    return 'unspecified';
  }

  /**
   * Identify body region from message
   * @param {string} normalized - Normalized message
   * @returns {string} - Body region
   */
  identifyBodyRegion(normalized) {
    for (const [region, terms] of Object.entries(this.medicalTerms.bodyRegions)) {
      if (terms.some(term => normalized.includes(term))) {
        return region;
      }
    }
    return 'unspecified';
  }

  /**
   * Identify medication from message
   * @param {string} normalized - Normalized message
   * @returns {string} - Medication name
   */
  identifyMedication(normalized) {
    for (const [medication, terms] of Object.entries(this.medicalTerms.medications)) {
      if (terms.some(term => normalized.includes(term))) {
        return medication;
      }
    }
    return 'unspecified';
  }

  /**
   * Extract medication dosage from message
   * @param {string} normalized - Normalized message
   * @returns {string} - Dosage information
   */
  extractDosage(normalized) {
    const dosagePattern = /(\d+(?:\.\d+)?)\s*(mg|mcg|units|tablet|dose|gram|ml)/i;
    const match = normalized.match(dosagePattern);
    return match ? `${match[1]} ${match[2]}` : null;
  }

  /**
   * Extract medication route from message
   * @param {string} normalized - Normalized message
   * @returns {string} - Route of administration
   */
  extractRoute(normalized) {
    if (/(oral|po|by mouth)/.test(normalized)) return 'oral';
    if (/(sublingual|sl|under tongue)/.test(normalized)) return 'sublingual';
    if (/(iv|intravenous)/.test(normalized)) return 'intravenous';
    if (/(im|intramuscular)/.test(normalized)) return 'intramuscular';
    if (/(inhaled|nebulized)/.test(normalized)) return 'inhaled';
    return null;
  }

  /**
   * Identify equipment from message
   * @param {string} normalized - Normalized message
   * @returns {string} - Equipment type
   */
  identifyEquipment(normalized) {
    for (const [equipmentType, terms] of Object.entries(this.medicalTerms.equipment)) {
      if (terms.some(term => normalized.includes(term))) {
        return equipmentType;
      }
    }
    return 'unspecified';
  }

  /**
   * Extract equipment application details
   * @param {string} normalized - Normalized message
   * @returns {string} - Application details
   */
  extractApplication(normalized) {
    if (/(2 lpm|4 lpm|6 lpm|8 lpm|10 lpm|15 lpm)/.test(normalized)) {
      const match = normalized.match(/(\d+)\s*lpm/);
      return match ? `${match[1]} LPM` : null;
    }
    return null;
  }

  /**
   * Identify assessment type from message
   * @param {string} normalized - Normalized message
   * @returns {string} - Assessment type
   */
  identifyAssessmentType(normalized) {
    if (/(inspect|look|examine|observe)/.test(normalized)) return 'inspection';
    if (/(palpate|feel|press|touch)/.test(normalized)) return 'palpation';
    if (/(listen|auscultate)/.test(normalized)) return 'auscultation';
    if (/(secondary|complete)/.test(normalized)) return 'secondary';
    return 'general';
  }

  /**
   * Identify patient position from message
   * @param {string} normalized - Normalized message
   * @returns {string} - Position type
   */
  identifyPosition(normalized) {
    if (/(upright|sitting|sit.*up|fowler)/.test(normalized)) return 'upright';
    if (/(supine|flat|back)/.test(normalized)) return 'supine';
    if (/(side|lateral|recovery)/.test(normalized)) return 'lateral';
    if (/(trendelenburg)/.test(normalized)) return 'trendelenburg';
    return 'unspecified';
  }

  /**
   * Extract transport priority from message
   * @param {string} normalized - Normalized message
   * @returns {string} - Transport priority
   */
  extractTransportPriority(normalized) {
    if (/(code\s*3|priority\s*3|emergent|lights.*sirens)/.test(normalized)) return 'code 3';
    if (/(code\s*2|priority\s*2|urgent)/.test(normalized)) return 'code 2';
    if (/(code\s*1|priority\s*1|non.*emergent|routine)/.test(normalized)) return 'code 1';
    return null;
  }

  /**
   * Extract transport destination from message
   * @param {string} normalized - Normalized message
   * @returns {string} - Destination
   */
  extractDestination(normalized) {
    const destMatch = normalized.match(/to\s+(the\s+)?((nearest\s+)?hospital|ed|er|emergency\s+department|[a-z\s]+ hospital)/);
    return destMatch ? destMatch[0].replace(/^to\s+(the\s+)?/, '') : null;
  }

  /**
   * Extract transport reason from message
   * @param {string} normalized - Normalized message
   * @returns {string} - Transport reason
   */
  extractTransportReason(normalized) {
    const reasonMatch = normalized.match(/(?:for|because\s+of|due\s+to)\s+([^.,;]+)/);
    return reasonMatch ? reasonMatch[1].trim() : null;
  }

  /**
   * Recognize general medical actions when specific patterns don't match
   * @param {string} normalized - Normalized message
   * @param {string} original - Original message
   * @returns {Object} - General action recognition result
   */
  recognizeGeneralMedicalAction(normalized, original) {
    // Check for any medical terms
    const foundTerms = [];
    
    Object.entries(this.medicalTerms).forEach(([category, terms]) => {
      Object.entries(terms).forEach(([termType, variations]) => {
        variations.forEach(variation => {
          if (normalized.includes(variation)) {
            foundTerms.push({ category, termType, term: variation });
          }
        });
      });
    });

    if (foundTerms.length > 0) {
      return {
        type: 'generalMedical',
        priority: 4,
        match: original,
        details: {
          actionType: 'generalMedical',
          foundTerms,
          needsClarification: true
        }
      };
    }

    // No medical terms found
    return {
      type: 'unknown',
      priority: 5,
      match: original,
      details: {
        actionType: 'unknown',
        needsClarification: true
      }
    };
  }

  /**
   * Generate clarification request for unclear actions
   * @param {Object} actionDetails - Details of the recognized action
   * @returns {string} - Clarification request
   */
  generateClarificationRequest(actionDetails) {
    switch (actionDetails.actionType) {
      case 'vitalCheck':
        if (actionDetails.vitalType === 'unspecified') {
          return 'Which specific vital sign would you like me to check?';
        }
        break;
        
      case 'medicationAdmin':
        if (actionDetails.medication === 'unspecified') {
          return 'Which medication would you like to administer?';
        }
        if (!actionDetails.dosage) {
          return `What dosage of ${actionDetails.medication} would you like to give?`;
        }
        break;
        
      case 'equipmentUse':
        if (actionDetails.equipment === 'unspecified') {
          return 'Which piece of equipment would you like to use?';
        }
        break;
        
      case 'physicalAssessment':
        if (actionDetails.bodyRegion === 'unspecified') {
          return 'Which body region would you like to assess?';
        }
        break;
        
      case 'generalMedical':
        const terms = actionDetails.foundTerms.map(t => t.term).join(', ');
        return `I understand you mentioned ${terms}. Can you be more specific about what you'd like to do?`;
        
      case 'unknown':
      default:
        return 'I\'m not sure what you\'d like me to do. Can you please clarify your action?';
    }
    
    return null;
  }

  /**
   * Check if action requires contraindication checking
   * @param {Object} actionDetails - Action details
   * @returns {boolean} - True if contraindication check needed
   */
  requiresContraindicationCheck(actionDetails) {
    return actionDetails.actionType === 'medicationAdmin' && 
           actionDetails.medication !== 'unspecified';
  }

  /**
   * Validate medication administration against patient profile
   * @param {Object} actionDetails - Action details
   * @param {Object} patientProfile - Patient profile from scenario
   * @returns {Object} - Validation result
   */
  validateMedicationAdmin(actionDetails, patientProfile) {
    const medication = actionDetails.medication;
    const allergies = patientProfile?.allergies || [];
    const medicalHistory = patientProfile?.medicalHistory || [];

    // Check allergies
    const allergyConflict = allergies.find(allergy => 
      allergy.toLowerCase().includes(medication) || 
      medication.includes(allergy.toLowerCase())
    );

    if (allergyConflict) {
      return {
        valid: false,
        reason: 'allergy',
        message: `Patient is allergic to ${allergyConflict}. This medication is contraindicated.`
      };
    }

    // Check specific medication contraindications
    const contraindications = this.getMedicationContraindications(medication, medicalHistory);
    if (contraindications.length > 0) {
      return {
        valid: false,
        reason: 'contraindication',
        message: `Contraindicated due to: ${contraindications.join(', ')}`
      };
    }

    return { valid: true };
  }

  /**
   * Get medication contraindications based on medical history
   * @param {string} medication - Medication name
   * @param {Array} medicalHistory - Patient's medical history
   * @returns {Array} - List of contraindications
   */
  getMedicationContraindications(medication, medicalHistory) {
    const contraindications = [];
    const history = medicalHistory.map(h => h.toLowerCase());

    switch (medication) {
      case 'aspirin':
        if (history.some(h => h.includes('bleeding') || h.includes('ulcer'))) {
          contraindications.push('bleeding disorder/ulcer');
        }
        break;
        
      case 'nitroglycerin':
        if (history.some(h => h.includes('viagra') || h.includes('cialis'))) {
          contraindications.push('recent ED medication use');
        }
        break;
        
      case 'epinephrine':
        // Generally safe in emergency situations
        break;
        
      case 'albuterol':
        if (history.some(h => h.includes('heart') && h.includes('severe'))) {
          contraindications.push('severe cardiac condition');
        }
        break;
    }

    return contraindications;
  }
}

module.exports = ActionRecognizer;
