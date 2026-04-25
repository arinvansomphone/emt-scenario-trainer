// services/gradingEngine.js
const TextNormalizer = require('./utils/textNormalizer');
const aiGradingService = require('./aiGradingService');

class GradingEngine {
  constructor() {
    this.rubric = this.initializeEMED111Rubric();
  }

  // Initialize the EMED111 rubric structure
  initializeEMED111Rubric() {
    return {
      totalPoints: 38, // 11 checkbox (3 pre-arrival + 6 primary survey + 2 disposition) + 27 scored (9 × 3)
      passRequirements: {
        allCheckboxItems: true,
        minimumScorePerSection: 2
      },
      timeLimit: 20, // minutes

      checkboxItems: {
        preArrivalSceneSize: [
          { id: 'ppe', description: 'Dons appropriate PPE', keywords: ['ppe', 'gloves', 'mask', 'eye protection', 'body substance isolation', 'bsi', 'protective', 'gear'] },
          { id: 'sceneSize', description: 'Performs scene survey with safety hazards', keywords: ['scene size', 'scene survey', 'safety', 'hazard', 'safe', 'environment', 'scene', 'secure'] },
          { id: 'spinalStab', description: 'Takes manual spinal stabilization if indicated', keywords: ['spinal', 'c-spine', 'c spine', 'stabilization', 'head', 'neck', 'spine', 'stabilize'] }
        ],
        primarySurvey: [
          { id: 'avpu', description: 'Determines level of responsiveness (AVPU) and obtains consent', keywords: ['avpu', 'responsive', 'alert', 'verbal', 'pain', 'unresponsive', 'consent', 'conscious', 'awake', 'okay', 'ok'] },
          { id: 'hemorrhage', description: 'Immediately manages massive hemorrhage if present', keywords: ['bleeding', 'hemorrhage', 'blood', 'tourniquet', 'pressure', 'bleed', 'bleeding control'] },
          { id: 'airway', description: 'Airway: patency, open if indicated, suction/adjunct if indicated', keywordGroups: [['airway', 'patency', 'open airway', 'jaw thrust', 'head tilt', 'chin lift'], ['suction', 'adjunct', 'airway adjunct']] },
          { id: 'breathing', description: 'Breathing: effort/rate, BVM if ineffective, SpO2/oxygen therapy', keywordGroups: [['breathing', 'effort', 'rate', 'respirations', 'breath', 'breathe'], ['bvm', 'ventilation', 'bag mask', 'ineffective'], ['spo2', 'sp02', 'pulse ox', 'oxygen', 'o2', 'oxygen therapy', 'nasal cannula', 'nrb']] },
          { id: 'circulation', description: 'Circulation: pulse, skin, cardiac arrest/CPR if present', keywordGroups: [['pulse', 'heart rate', 'radial', 'carotid', 'brachial', 'hr', 'bpm'], ['skin', 'color', 'temperature', 'condition', 'pale', 'cyanotic', 'temp', 'warm', 'cool'], ['cardiac arrest', 'cpr', 'chest compressions', 'no pulse', 'compressions']] },
          { id: 'transport', description: 'States transport urgency and/or immediate need for ALS', keywords: ['transport', 'als', 'priority', 'urgent', 'emergent', 'hospital', 'ambulance', 'taking you'] }
        ],
        disposition: [
          { id: 'fieldImpression', description: 'States appropriate field impression', keywords: ['field impression', 'impression', 'possible', 'suspected', 'rule out', 'r/o', 'mi', 'stroke', 'hypoglycemia', 'assessment'] },
          { id: 'transportDestination', description: 'States appropriate transport destination and traffic priority with reasonable justification', keywords: ['transport', 'destination', 'hospital', 'ed', 'emergency', 'priority', 'traffic', 'lights', 'sirens', 'code', 'justification', 'reason', 'because'] }
        ]
      },

      scoredSections: [
        {
          id: 'hpi',
          name: 'History of Present Illness',
          maxScore: 3,
          criteria: {
            0: 'not attempted',
            1: 'obtains an HPI that is incomplete or not aligned with the patient\'s complaint',
            2: 'obtains a complete HPI using an appropriate standard mnemonic',
            3: 'obtains a thorough HPI structured around the DDX'
          },
          keywords: ['onset', 'provocation', 'quality', 'radiation', 'severity', 'time', 'opqrst', 'history', 'when', 'started', 'began', 'describe', 'feel', 'rate', 'scale', 'constant', 'pain', 'chief complaint']
        },
        {
          id: 'pmh',
          name: 'Past Medical History',
          maxScore: 3,
          criteria: {
            0: 'not attempted',
            1: 'obtains an incomplete SAMPLE history',
            2: 'obtains a complete SAMPLE history',
            3: 'obtains a thorough PMHx structured around the DDX'
          },
          keywords: ['sample', 'allergies', 'allergy', 'medications', 'meds', 'medicines', 'past medical', 'last meal', 'events', 'conditions', 'ate', 'medical history']
        },
        {
          id: 'vitals',
          name: 'Vital Signs',
          maxScore: 3,
          criteria: {
            0: 'not attempted',
            1: 'obtains incomplete vital signs or fails to acknowledge a finding outside of normal limits',
            2: 'obtains complete vital signs (HR, RR, SBP/DBP, Temp, SpO2) and acknowledges abnormal findings',
            3: 'obtains initial and repeat vital signs and interprets trends within the context of the patient\'s condition'
          },
          keywords: ['vital signs', 'vitals', 'blood pressure', 'heart rate', 'respiratory rate', 'temperature', 'pulse ox', 'spo2', 'pulse', 'oxygen', 'oxygen level', 'bp', 'hr', 'bpm']
        },
        {
          id: 'physicalExam',
          name: 'Physical Exam',
          maxScore: 3,
          criteria: {
            0: 'not attempted',
            1: 'physical exam is incomplete for complaint or performed with poor technique',
            2: 'physical exam is adequate for complaint and performed with proper technique',
            3: 'well-performed physical exam is structured around DDX and integrated into patient assessment'
          },
          keywords: ['physical exam', 'assessment', 'palpate', 'auscultate', 'inspect', 'examine', 'check', 'pupils', 'look', 'feel']
        },
        {
          id: 'medicalManagement',
          name: 'Medical Management',
          maxScore: 3,
          criteria: {
            0: 'orders or performs an inappropriate or harmful intervention',
            1: 'fails to appropriately manage patient\'s condition and/or reassess patient',
            2: 'completes all required scenario-specific interventions and reassesses patient',
            3: 'confidently manages all aspects of patient\'s condition and continuously reassesses for changes'
          },
          keywords: ['treatment', 'intervention', 'medication', 'therapy', 'management', 'reassess', 'give', 'administer', 'aspirin', 'oxygen', 'glucose', 'albuterol', 'recheck']
        },
        {
          id: 'patientInteraction',
          name: 'Provider-Patient Interaction',
          maxScore: 3,
          criteria: {
            0: 'exhibits inappropriate or unprofessional behavior',
            1: 'is impersonal and/or demonstrates limited engagement with patient',
            2: 'maintains professional affect, communicates clearly, and acknowledges patient needs',
            3: 'establishes patient rapport and demonstrates therapeutic communication'
          },
          keywords: ['communication', 'rapport', 'professional', 'empathy', 'bedside manner', 'please', 'thank', 'care', 'calm', 'reassure']
        },
        {
          id: 'hospitalRadio',
          name: 'Hospital Radio Notification',
          maxScore: 3,
          criteria: {
            0: 'not attempted',
            1: 'incomplete, disorganized, inaccurate, or over 1 minute in duration',
            2: 'contains all relevant information, is logically organized, and is under 1 minute in duration',
            3: 'contains only the relevant information and is under 30 seconds in duration'
          },
          keywords: ['hospital', 'radio', 'notification', 'report', 'eta', 'notify', 'calling', 'alert', 'coming']
        },
        {
          id: 'handover',
          name: 'Handover Report',
          maxScore: 3,
          criteria: {
            0: 'not attempted',
            1: 'incomplete, disorganized, or inaccurate',
            2: 'contains all relevant information and is logically organized',
            3: 'contains only the relevant information organized around the patient complaint and field impression'
          },
          keywords: ['handover', 'report', 'transfer of care', 'giving report', 'transfer', 'give report']
        },
        {
          id: 'leadership',
          name: 'Scene and Resource Management',
          maxScore: 3,
          criteria: {
            0: 'compromises safety or acts unprofessionally towards other providers',
            1: 'demonstrates minimal situational awareness or ineffectively utilizes partner(s)',
            2: 'manages scene hazards, delegates tasks appropriately, and requests resources as required',
            3: 'displays continuous situational awareness and utilizes partner(s) to provide collaborative patient care'
          },
          keywords: ['leadership', 'delegation', 'resources', 'partner', 'teamwork', 'scene management', 'delegate', 'assist', 'help']
        }
      ]
    };
  }

  // Grade the entire scenario (async: uses AI for scored sections when enabled)
  async gradeScenario(conversation, scenarioData, timeSpentMinutes, examAssessmentResults = null) {
    console.log('🎯 Starting scenario grading...');
    if (!Array.isArray(conversation)) {
      console.warn('⚠️ gradeScenario received non-array conversation, defaulting to empty array');
      conversation = [];
    }

    // Checkbox items: keyword-based (kept for protocol compliance)
    const checkboxItems = this.gradeCheckboxItems(conversation, scenarioData);

    // Scored sections: AI grading with keyword fallback
    const scoredSections = await this.gradeScoredSectionsHybrid(
      conversation,
      scenarioData,
      examAssessmentResults
    );

    const results = {
      checkboxItems,
      scoredSections,
      timeManagement: this.gradeTimeManagement(timeSpentMinutes),
      examAssessments: examAssessmentResults || {},
      overallPass: false,
      totalScore: 0,
      feedback: []
    };

    // Calculate total score: checkbox items (1 pt each) + scored sections (0-3 each)
    const checkboxPoints = Object.values(results.checkboxItems).filter(item => item.completed).length;
    const scoredPoints = Object.values(results.scoredSections).reduce((sum, section) => sum + section.score, 0);
    results.totalScore = checkboxPoints + scoredPoints;

    // Determine pass/fail
    const allCheckboxesPassed = Object.values(results.checkboxItems).every(item => item.completed);
    const allSectionsMinimum = Object.values(results.scoredSections).every(section => section.score >= 2);
    const timePass = results.timeManagement.passed;

    results.overallPass = allCheckboxesPassed && allSectionsMinimum && timePass;

    console.log(`📊 Grading complete. Score: ${results.totalScore}/${this.rubric.totalPoints} (checkbox: ${checkboxPoints}, scored: ${scoredPoints}), Pass: ${results.overallPass}`);
    return results;
  }

  // Grade checkbox (critical) items
  gradeCheckboxItems(conversation, scenarioData) {
    const results = {};
    const conversationText = this.getConversationText(conversation);

    const checkItem = (item) => {
      if (item.keywordGroups) {
        // All groups must have at least one match for the point to count
        return item.keywordGroups.every(group =>
          this.checkKeywordsInConversation(conversationText, group)
        );
      }
      return this.checkKeywordsInConversation(conversationText, item.keywords || []);
    };

    // Grade Pre-Arrival & Scene Size-Up items
    this.rubric.checkboxItems.preArrivalSceneSize.forEach(item => {
      results[item.id] = {
        description: item.description,
        completed: checkItem(item),
        category: 'Pre-Arrival & Scene Size-Up'
      };
    });

    // Grade Primary Survey items
    this.rubric.checkboxItems.primarySurvey.forEach(item => {
      results[item.id] = {
        description: item.description,
        completed: checkItem(item),
        category: 'Primary Survey & Resuscitation'
      };
    });

    // Grade Disposition items (1 pt each)
    this.rubric.checkboxItems.disposition.forEach(item => {
      results[item.id] = {
        description: item.description,
        completed: checkItem(item),
        category: 'Disposition'
      };
    });

    return results;
  }

  // Hybrid: AI grading for scored sections, with keyword fallback
  async gradeScoredSectionsHybrid(conversation, scenarioData, examAssessmentResults = null) {
    const conversationText = this.getConversationText(conversation);
    let aiScores = null;

    try {
      aiScores = await aiGradingService.gradeScoredSectionsWithAI(
        conversation,
        this.rubric.scoredSections,
        scenarioData
      );
    } catch (err) {
      console.warn('AI grading error:', err.message);
    }

    const results = {};
    for (const section of this.rubric.scoredSections) {
      let score;
      let aiGraded = false;

      if (aiScores && typeof aiScores[section.id] === 'number') {
        score = Math.min(3, Math.max(0, aiScores[section.id]));
        aiGraded = true;
      } else {
        score = this.scoreSectionBasedOnContent(conversationText, section, conversation);
      }

      // Enhance physical exam with assessment results (if available)
      if (examAssessmentResults && section.id === 'physicalExam') {
        score = this.enhancePhysicalExamScore(score, examAssessmentResults);
      }

      results[section.id] = {
        score,
        maxScore: section.maxScore,
        name: section.name,
        criteria: section.criteria[score],
        feedback: this.generateSectionFeedback(conversationText, section, score),
        examAssessmentEnhanced: examAssessmentResults && section.id === 'physicalExam',
        aiGraded
      };
    }
    return results;
  }

  // Grade scored sections (0-3 points each) - keyword-based fallback
  gradeScoredSections(conversation, scenarioData, examAssessmentResults = null) {
    const results = {};
    const conversationText = this.getConversationText(conversation);

    this.rubric.scoredSections.forEach(section => {
      let score = this.scoreSectionBasedOnContent(conversationText, section, conversation);

      if (examAssessmentResults && section.id === 'physicalExam') {
        score = this.enhancePhysicalExamScore(score, examAssessmentResults);
      }

      results[section.id] = {
        score,
        maxScore: section.maxScore,
        name: section.name,
        criteria: section.criteria[score],
        feedback: this.generateSectionFeedback(conversationText, section, score),
        examAssessmentEnhanced: examAssessmentResults && section.id === 'physicalExam'
      };
    });

    return results;
  }

  // Score individual section based on conversation content
  scoreSectionBasedOnContent(conversationText, section, conversation) {
    const keywordMatches = this.checkKeywordsInConversation(conversationText, section.keywords);
    
    if (!keywordMatches) {
      return 0; // Not attempted
    }

    // Count relevant interactions for this section
    const relevantInteractions = this.countRelevantInteractions(conversation, section.keywords);
    
    // Special scoring logic for specific sections
    switch (section.id) {
      case 'hpi':
        return this.scoreHPI(conversation);
      case 'pmh':
        return this.scorePMH(conversation);
      case 'vitals':
        return this.scoreVitals(conversation);
      case 'physicalExam':
        return this.scorePhysicalExam(conversation);
      case 'medicalManagement':
        return this.scoreMedicalManagement(conversation);
      case 'patientInteraction':
        return this.scorePatientInteraction(conversation);
      case 'hospitalRadio':
        return this.scoreHospitalRadio(conversation);
      case 'handover':
        return this.scoreHandover(conversation);
      case 'leadership':
        return this.scoreLeadership(conversation);
      default:
        // Default scoring based on keyword matches and interactions
        if (relevantInteractions >= 3) return 3;
        if (relevantInteractions >= 2) return 2;
        if (relevantInteractions >= 1) return 1;
        return 0;
    }
  }

  // Specific scoring methods for each section
  scoreHPI(conversation) {
    const opqrstGroups = [
      ['onset', 'when', 'started', 'began', 'ago', 'minutes', 'hours'],
      ['provocation', 'doing', 'make', 'worse', 'better', 'activity'],
      ['quality', 'describe', 'feel', 'like', 'pressure', 'tight', 'squeezing', 'crushing', 'heavy'],
      ['radiation', 'radiate', 'goes', 'else', 'arm', 'jaw', 'back'],
      ['severity', 'rate', 'scale', 'severe', 'bad'],
      ['time', 'constant', 'come and go', 'intermittent']
    ];
    const text = this.getConversationText(conversation);
    const foundElements = opqrstGroups.filter(group =>
      this.checkKeywordsInConversation(text, group)
    );

    if (foundElements.length === 0) return 0;
    if (foundElements.length < 3) return 1;
    if (foundElements.length < 6) return 2;
    return 3;
  }

  scorePMH(conversation) {
    const sampleGroups = [
      ['allergies', 'allergy', 'allergic'],
      ['medications', 'meds', 'medicines', 'take', 'prescription'],
      ['past medical', 'medical history', 'conditions', 'history'],
      ['last meal', 'ate', 'eat', 'eating', 'food'],
      ['events', 'happened', 'leading', 'before']
    ];
    const text = this.getConversationText(conversation);
    const foundElements = sampleGroups.filter(group =>
      this.checkKeywordsInConversation(text, group)
    );

    if (foundElements.length === 0) return 0;
    if (foundElements.length < 3) return 1;
    if (foundElements.length < 5) return 2;
    return 3;
  }

  scoreVitals(conversation) {
    const vitalGroups = [
      ['blood pressure', 'bp', 'pressure'],
      ['heart rate', 'pulse', 'hr', 'bpm'],
      ['respiratory rate', 'breathing', 'respirations', 'breath'],
      ['temperature', 'temp'],
      ['pulse ox', 'spo2', 'sp02', 'oxygen', 'oxygen level', 'oxygen saturation', 'sats', 'sat']
    ];
    const text = this.getConversationText(conversation);
    const foundVitals = vitalGroups.filter(group =>
      this.checkKeywordsInConversation(text, group)
    );
    const repeatVitals = this.checkKeywordsInConversation(text, ['repeat vitals', 'second set', 'recheck vitals', 'check again']);

    if (foundVitals.length === 0) return 0;
    if (foundVitals.length < 3) return 1;
    if (foundVitals.length >= 4 && !repeatVitals) return 2;
    if (foundVitals.length >= 4 && repeatVitals) return 3;
    return 1;
  }

  scorePhysicalExam(conversation) {
    const examGroups = [
      ['inspect', 'look', 'check', 'see'],
      ['palpate', 'feel', 'touch', 'press'],
      ['auscultate', 'listen', 'stethoscope'],
      ['examine', 'assessment', 'physical exam', 'check', 'pupils']
    ];
    const text = this.getConversationText(conversation);
    const foundActions = examGroups.filter(group =>
      this.checkKeywordsInConversation(text, group)
    );

    if (foundActions.length === 0) return 0;
    if (foundActions.length < 2) return 1;
    if (foundActions.length < 3) return 2;
    return 3;
  }

  scoreMedicalManagement(conversation) {
    const treatmentKeywords = ['treatment', 'medication', 'intervention', 'therapy', 'give', 'administer', 'aspirin', 'oxygen', 'glucose', 'albuterol'];
    const reassessKeywords = ['reassess', 'recheck', 'check again', 'how are you feeling', 'feeling now', 'better'];
    const treatments = this.countRelevantInteractions(conversation, treatmentKeywords);
    const reassessment = this.checkKeywordsInConversation(this.getConversationText(conversation), reassessKeywords);

    if (treatments === 0) return 0;
    if (treatments < 2 && !reassessment) return 1;
    if (treatments >= 2 && reassessment) return 2;
    if (treatments >= 3 && reassessment) return 3;
    return 1;
  }

  scorePatientInteraction(conversation) {
    const professionalWords = ['please', 'thank you', 'thanks', 'sir', 'ma\'am', 'how are you feeling', 'calm', 'reassure', 'care'];
    const empathyWords = ['understand', 'comfortable', 'help', 'support', 'okay', 'ok'];
    
    const professionalism = professionalWords.some(word => 
      this.checkKeywordsInConversation(this.getConversationText(conversation), [word])
    );
    const empathy = empathyWords.some(word => 
      this.checkKeywordsInConversation(this.getConversationText(conversation), [word])
    );

    if (!professionalism && !empathy) return 0;
    if (professionalism && !empathy) return 1;
    if (professionalism && empathy) return 2;
    
    // Check for therapeutic communication
    const therapeuticWords = ['rapport', 'active listening', 'validation', 'validate'];
    const therapeutic = therapeuticWords.some(word => 
      this.checkKeywordsInConversation(this.getConversationText(conversation), [word])
    );
    
    if (professionalism && empathy && therapeutic) return 3;
    return 2;
  }

  scoreHospitalRadio(conversation) {
    const radioKeywords = ['hospital', 'radio', 'notification', 'report', 'eta', 'notify', 'calling', 'alert', 'coming'];
    if (!this.checkKeywordsInConversation(this.getConversationText(conversation), radioKeywords)) {
      return 0;
    }

    // Check for completeness and organization
    const essentialElements = ['age', 'chief complaint', 'complaint', 'eta', 'priority', 'transport', 'coming'];
    const foundElements = essentialElements.filter(element => 
      this.checkKeywordsInConversation(this.getConversationText(conversation), [element])
    );

    if (foundElements.length < 2) return 1;
    if (foundElements.length < 4) return 2;
    return 3;
  }

  scoreHandover(conversation) {
    const handoverKeywords = ['handover', 'report', 'transfer of care', 'giving report', 'transfer', 'give report'];
    if (!this.checkKeywordsInConversation(this.getConversationText(conversation), handoverKeywords)) {
      return 0;
    }

    // Check for completeness
    const handoverElements = ['age', 'complaint', 'findings', 'vitals', 'treatments', 'history', 'condition'];
    const foundElements = handoverElements.filter(element => 
      this.checkKeywordsInConversation(this.getConversationText(conversation), [element])
    );

    if (foundElements.length < 2) return 1;
    if (foundElements.length < 4) return 2;
    return 3;
  }

  scoreDisposition(conversation) {
    const dispositionKeywords = ['field impression', 'transport', 'destination', 'hospital', 'ambulance', 'taking you', 'checked out', 'get you'];
    const foundElements = dispositionKeywords.filter(keyword => 
      this.checkKeywordsInConversation(this.getConversationText(conversation), [keyword])
    );

    if (foundElements.length === 0) return 0;
    if (foundElements.length < 2) return 1;
    if (foundElements.length < 3) return 2;
    return 3;
  }

  scoreLeadership(conversation) {
    const leadershipKeywords = ['delegate', 'partner', 'help', 'assist', 'teamwork', 'delegation'];
    const safetyKeywords = ['safety', 'hazard', 'secure', 'safe', 'scene'];
    
    const leadership = this.checkKeywordsInConversation(this.getConversationText(conversation), leadershipKeywords);
    const safety = this.checkKeywordsInConversation(this.getConversationText(conversation), safetyKeywords);

    if (!leadership && !safety) return 0;
    if (leadership || safety) return 1;
    if (leadership && safety) return 2;
    
    // Check for advanced leadership indicators
    const advancedKeywords = ['situational awareness', 'resource management', 'collaborative'];
    const advanced = this.checkKeywordsInConversation(this.getConversationText(conversation), advancedKeywords);
    
    if (leadership && safety && advanced) return 3;
    return 2;
  }

  // Grade time management
  gradeTimeManagement(timeSpentMinutes) {
    const passed = timeSpentMinutes <= this.rubric.timeLimit;
    return {
      timeSpent: timeSpentMinutes,
      timeLimit: this.rubric.timeLimit,
      passed,
      feedback: passed ? 
        'Completed within time limit' : 
        `Exceeded time limit by ${timeSpentMinutes - this.rubric.timeLimit} minutes`
    };
  }

  // Helper methods
  getConversationText(conversation) {
    if (!Array.isArray(conversation)) return '';
    // Include both user (student) and assistant (patient) messages for grading.
    // Student questions elicit patient responses; both reflect assessment quality.
    return conversation
      .filter(msg => msg && (msg.role === 'user' || msg.role === 'assistant'))
      .map(msg => msg.content || '')
      .join(' ')
      .toLowerCase();
  }

  checkKeywordsInConversation(text, keywords) {
    return keywords.some(keyword => {
      const normalizedKeyword = TextNormalizer.normalizeToAsciiLower(keyword);
      const normalizedText = TextNormalizer.normalizeToAsciiLower(text);
      return normalizedText.includes(normalizedKeyword);
    });
  }

  countRelevantInteractions(conversation, keywords) {
    if (!Array.isArray(conversation)) return 0;
    // Count interactions in both user (student) and assistant (patient) messages.
    let count = 0;
    const messages = conversation.filter(msg => msg && (msg.role === 'user' || msg.role === 'assistant'));
    
    messages.forEach(msg => {
      if (msg.content && this.checkKeywordsInConversation(msg.content, keywords)) {
        count++;
      }
    });
    
    return count;
  }

  generateSectionFeedback(conversationText, section, score) {
    const feedback = [];
    const maxScore = section.maxScore;

    // If the user got full points, no improvement feedback needed
    if (score >= maxScore) {
      return feedback;
    }

    // Explain what's needed to reach the next level by referencing the rubric criteria
    const nextLevel = score + 1;
    const nextCriteria = section.criteria?.[nextLevel];
    if (nextCriteria) {
      feedback.push(`To earn ${nextLevel} point${nextLevel === 1 ? '' : 's'}, you need to ${nextCriteria}.`);
    }

    // If they're not at max yet, also describe what full points requires
    if (nextLevel < maxScore) {
      const topCriteria = section.criteria?.[maxScore];
      if (topCriteria) {
        feedback.push(`For full credit (${maxScore} points), ${topCriteria}.`);
      }
    }

    // Suggest specific keywords/topics that were missing from the conversation
    const missingKeywords = (section.keywords || []).filter(kw => {
      const normalizedKeyword = TextNormalizer.normalizeToAsciiLower(kw);
      const normalizedText = TextNormalizer.normalizeToAsciiLower(conversationText);
      return !normalizedText.includes(normalizedKeyword);
    });
    if (missingKeywords.length > 0) {
      feedback.push(`Topics/elements that were missing or could be addressed: ${missingKeywords.slice(0, 5).join(', ')}.`);
    }

    return feedback;
  }

  // Enhance physical exam score based on assessment results
  enhancePhysicalExamScore(conversationScore, examAssessmentResults) {
    if (!examAssessmentResults || !examAssessmentResults.overallScore) {
      return conversationScore;
    }

    // Convert assessment percentage to 0-3 scale
    const assessmentScore = Math.round((examAssessmentResults.overallScore / 100) * 3);
    
    // Combine conversation-based score with assessment score (weighted)
    // 60% assessment knowledge, 40% conversation demonstration
    const combinedScore = Math.round((assessmentScore * 0.6) + (conversationScore * 0.4));
    
    // Cap at maximum score of 3
    return Math.min(3, Math.max(0, combinedScore));
  }

  // Generate comprehensive feedback report
  generateFeedbackReport(gradingResults, scenarioData) {
    const report = {
      summary: {
        totalScore: gradingResults.totalScore,
        maxScore: this.rubric.totalPoints,
        percentage: Math.round((gradingResults.totalScore / this.rubric.totalPoints) * 100),
        pass: gradingResults.overallPass,
        timeSpent: gradingResults.timeManagement.timeSpent,
        timeLimit: gradingResults.timeManagement.timeLimit
      },
      checkboxItems: {
        completed: Object.values(gradingResults.checkboxItems).filter(item => item.completed).length,
        total: Object.keys(gradingResults.checkboxItems).length,
        details: gradingResults.checkboxItems
      },
      scoredSections: gradingResults.scoredSections,
      recommendations: this.generateRecommendations(gradingResults),
      strengths: this.identifyStrengths(gradingResults),
      areasForImprovement: this.identifyAreasForImprovement(gradingResults)
    };

    return report;
  }

  generateRecommendations(gradingResults) {
    const recommendations = [];

    // Check for failed checkbox items
    Object.entries(gradingResults.checkboxItems).forEach(([key, item]) => {
      if (!item.completed) {
        recommendations.push(`Critical: Complete ${item.description}`);
      }
    });

    // Check for low-scoring sections
    Object.entries(gradingResults.scoredSections).forEach(([key, section]) => {
      if (section.score < 2) {
        recommendations.push(`Improve ${section.name}: ${section.criteria}`);
      }
    });

    if (!gradingResults.timeManagement.passed) {
      recommendations.push('Work on time management - practice completing assessments more efficiently');
    }

    return recommendations;
  }

  identifyStrengths(gradingResults) {
    const strengths = [];

    Object.entries(gradingResults.scoredSections).forEach(([key, section]) => {
      if (section.score === 3) {
        strengths.push(`Excellent ${section.name}`);
      }
    });

    const completedCheckboxes = Object.values(gradingResults.checkboxItems).filter(item => item.completed).length;
    const totalCheckboxes = Object.keys(gradingResults.checkboxItems).length;
    
    if (completedCheckboxes === totalCheckboxes) {
      strengths.push('Completed all critical assessment items');
    }

    if (gradingResults.timeManagement.passed) {
      strengths.push('Good time management');
    }

    return strengths;
  }

  identifyAreasForImprovement(gradingResults) {
    const areas = [];

    Object.entries(gradingResults.scoredSections).forEach(([key, section]) => {
      if (section.score < 2) {
        areas.push(section.name);
      }
    });

    const failedCheckboxes = Object.entries(gradingResults.checkboxItems)
      .filter(([key, item]) => !item.completed)
      .map(([key, item]) => item.category);

    areas.push(...[...new Set(failedCheckboxes)]); // Remove duplicates

    return areas;
  }
}

module.exports = new GradingEngine();
