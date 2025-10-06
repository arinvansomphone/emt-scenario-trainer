// services/gradingEngine.js
const TextNormalizer = require('./utils/textNormalizer');

class GradingEngine {
  constructor() {
    this.rubric = this.initializeEMED111Rubric();
  }

  // Initialize the EMED111 rubric structure
  initializeEMED111Rubric() {
    return {
      totalPoints: 38,
      passRequirements: {
        allCheckboxItems: true,
        minimumScorePerSection: 2
      },
      timeLimit: 20, // minutes

      checkboxItems: {
        preArrivalSceneSize: [
          { id: 'ppe', description: 'Dons appropriate PPE', keywords: ['ppe', 'gloves', 'mask', 'eye protection', 'body substance isolation', 'bsi'] },
          { id: 'sceneSize', description: 'Performs scene survey with safety hazards', keywords: ['scene size', 'scene survey', 'safety', 'hazard', 'safe', 'environment'] },
          { id: 'spinalStab', description: 'Takes manual spinal stabilization if indicated', keywords: ['spinal', 'c-spine', 'stabilization', 'head', 'neck'] }
        ],
        primarySurvey: [
          { id: 'avpu', description: 'Determines responsiveness (AVPU) and consent', keywords: ['avpu', 'responsive', 'alert', 'verbal', 'pain', 'unresponsive', 'consent'] },
          { id: 'hemorrhage', description: 'Manages massive hemorrhage if present', keywords: ['bleeding', 'hemorrhage', 'blood', 'tourniquet', 'pressure'] },
          { id: 'airway', description: 'Airway assessment and management', keywords: ['airway', 'open airway', 'jaw thrust', 'head tilt', 'chin lift'] },
          { id: 'breathing', description: 'Breathing assessment and intervention', keywords: ['breathing', 'ventilation', 'bvm', 'bag mask', 'respiratory'] },
          { id: 'oxygen', description: 'SpO2 and oxygen therapy', keywords: ['spo2', 'pulse ox', 'oxygen', 'o2', 'nasal cannula', 'nrb'] },
          { id: 'pulse', description: 'Pulse assessment', keywords: ['pulse', 'heart rate', 'radial', 'carotid', 'brachial'] },
          { id: 'skin', description: 'Skin assessment', keywords: ['skin', 'color', 'temperature', 'condition', 'pale', 'cyanotic'] },
          { id: 'cpr', description: 'Recognizes cardiac arrest and begins CPR', keywords: ['cardiac arrest', 'cpr', 'chest compressions', 'no pulse'] },
          { id: 'transport', description: 'States transport urgency/ALS need', keywords: ['transport', 'als', 'priority', 'urgent', 'emergent'] }
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
          keywords: ['onset', 'provocation', 'quality', 'radiation', 'severity', 'time', 'opqrst', 'history']
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
          keywords: ['sample', 'allergies', 'medications', 'past medical', 'last meal', 'events']
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
          keywords: ['vital signs', 'blood pressure', 'heart rate', 'respiratory rate', 'temperature', 'pulse ox']
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
          keywords: ['physical exam', 'assessment', 'palpate', 'auscultate', 'inspect', 'examine']
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
          keywords: ['treatment', 'intervention', 'medication', 'therapy', 'management', 'reassess']
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
          keywords: ['communication', 'rapport', 'professional', 'empathy', 'bedside manner']
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
          keywords: ['hospital', 'radio', 'notification', 'report', 'eta']
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
          keywords: ['handover', 'report', 'transfer of care', 'giving report']
        },
        {
          id: 'disposition',
          name: 'Disposition',
          maxScore: 3,
          criteria: {
            0: 'not attempted',
            1: 'incomplete or inappropriate',
            2: 'states appropriate field impression and transport destination',
            3: 'comprehensive disposition with clear reasoning'
          },
          keywords: ['field impression', 'transport', 'destination', 'priority', 'disposition']
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
          keywords: ['leadership', 'delegation', 'resources', 'partner', 'teamwork', 'scene management']
        }
      ]
    };
  }

  // Grade the entire scenario based on conversation history
  gradeScenario(conversation, scenarioData, timeSpentMinutes, examAssessmentResults = null) {
    console.log('🎯 Starting scenario grading...');
    
    const results = {
      checkboxItems: this.gradeCheckboxItems(conversation, scenarioData),
      scoredSections: this.gradeScoredSections(conversation, scenarioData, examAssessmentResults),
      timeManagement: this.gradeTimeManagement(timeSpentMinutes),
      examAssessments: examAssessmentResults || {},
      overallPass: false,
      totalScore: 0,
      feedback: []
    };

    // Calculate total score
    results.totalScore = Object.values(results.scoredSections).reduce((sum, section) => sum + section.score, 0);

    // Determine pass/fail
    const allCheckboxesPassed = Object.values(results.checkboxItems).every(item => item.completed);
    const allSectionsMinimum = Object.values(results.scoredSections).every(section => section.score >= 2);
    const timePass = results.timeManagement.passed;

    results.overallPass = allCheckboxesPassed && allSectionsMinimum && timePass;

    console.log(`📊 Grading complete. Score: ${results.totalScore}/38, Pass: ${results.overallPass}`);
    return results;
  }

  // Grade checkbox (critical) items
  gradeCheckboxItems(conversation, scenarioData) {
    const results = {};
    const conversationText = this.getConversationText(conversation);

    // Grade Pre-Arrival & Scene Size-Up items
    this.rubric.checkboxItems.preArrivalSceneSize.forEach(item => {
      results[item.id] = {
        description: item.description,
        completed: this.checkKeywordsInConversation(conversationText, item.keywords),
        category: 'Pre-Arrival & Scene Size-Up'
      };
    });

    // Grade Primary Survey items
    this.rubric.checkboxItems.primarySurvey.forEach(item => {
      results[item.id] = {
        description: item.description,
        completed: this.checkKeywordsInConversation(conversationText, item.keywords),
        category: 'Primary Survey & Resuscitation'
      };
    });

    return results;
  }

  // Grade scored sections (0-3 points each)
  gradeScoredSections(conversation, scenarioData, examAssessmentResults = null) {
    const results = {};
    const conversationText = this.getConversationText(conversation);

    this.rubric.scoredSections.forEach(section => {
      let score = this.scoreSectionBasedOnContent(conversationText, section, conversation);
      
      // Enhance physical exam scoring with assessment results
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
      case 'disposition':
        return this.scoreDisposition(conversation);
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
    const opqrstElements = ['onset', 'provocation', 'quality', 'radiation', 'severity', 'time'];
    const foundElements = opqrstElements.filter(element => 
      this.checkKeywordsInConversation(this.getConversationText(conversation), [element])
    );

    if (foundElements.length === 0) return 0;
    if (foundElements.length < 3) return 1;
    if (foundElements.length < 6) return 2;
    return 3;
  }

  scorePMH(conversation) {
    const sampleElements = ['allergies', 'medications', 'past medical', 'last meal', 'events'];
    const foundElements = sampleElements.filter(element => 
      this.checkKeywordsInConversation(this.getConversationText(conversation), [element])
    );

    if (foundElements.length === 0) return 0;
    if (foundElements.length < 3) return 1;
    if (foundElements.length < 5) return 2;
    return 3;
  }

  scoreVitals(conversation) {
    const vitalSigns = ['blood pressure', 'heart rate', 'respiratory rate', 'temperature', 'pulse ox'];
    const foundVitals = vitalSigns.filter(vital => 
      this.checkKeywordsInConversation(this.getConversationText(conversation), [vital])
    );

    const repeatVitals = this.checkKeywordsInConversation(this.getConversationText(conversation), ['repeat vitals', 'second set']);

    if (foundVitals.length === 0) return 0;
    if (foundVitals.length < 3) return 1;
    if (foundVitals.length >= 4 && !repeatVitals) return 2;
    if (foundVitals.length >= 4 && repeatVitals) return 3;
    return 1;
  }

  scorePhysicalExam(conversation) {
    const examActions = ['inspect', 'palpate', 'auscultate', 'examine'];
    const foundActions = examActions.filter(action => 
      this.checkKeywordsInConversation(this.getConversationText(conversation), [action])
    );

    if (foundActions.length === 0) return 0;
    if (foundActions.length < 2) return 1;
    if (foundActions.length < 3) return 2;
    return 3;
  }

  scoreMedicalManagement(conversation) {
    const treatments = this.countRelevantInteractions(conversation, ['treatment', 'medication', 'intervention', 'therapy']);
    const reassessment = this.checkKeywordsInConversation(this.getConversationText(conversation), ['reassess', 'recheck']);

    if (treatments === 0) return 0;
    if (treatments < 2 && !reassessment) return 1;
    if (treatments >= 2 && reassessment) return 2;
    if (treatments >= 3 && reassessment) return 3;
    return 1;
  }

  scorePatientInteraction(conversation) {
    const professionalWords = ['please', 'thank you', 'sir', 'ma\'am', 'how are you feeling'];
    const empathyWords = ['understand', 'comfortable', 'help', 'support'];
    
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
    const therapeuticWords = ['rapport', 'active listening', 'validation'];
    const therapeutic = therapeuticWords.some(word => 
      this.checkKeywordsInConversation(this.getConversationText(conversation), [word])
    );
    
    if (professionalism && empathy && therapeutic) return 3;
    return 2;
  }

  scoreHospitalRadio(conversation) {
    const radioKeywords = ['hospital', 'radio', 'notification', 'eta'];
    if (!this.checkKeywordsInConversation(this.getConversationText(conversation), radioKeywords)) {
      return 0;
    }

    // Check for completeness and organization
    const essentialElements = ['age', 'chief complaint', 'eta', 'priority'];
    const foundElements = essentialElements.filter(element => 
      this.checkKeywordsInConversation(this.getConversationText(conversation), [element])
    );

    if (foundElements.length < 2) return 1;
    if (foundElements.length < 4) return 2;
    return 3;
  }

  scoreHandover(conversation) {
    const handoverKeywords = ['handover', 'report', 'transfer of care', 'giving report'];
    if (!this.checkKeywordsInConversation(this.getConversationText(conversation), handoverKeywords)) {
      return 0;
    }

    // Check for completeness
    const handoverElements = ['age', 'complaint', 'findings', 'vitals', 'treatments'];
    const foundElements = handoverElements.filter(element => 
      this.checkKeywordsInConversation(this.getConversationText(conversation), [element])
    );

    if (foundElements.length < 2) return 1;
    if (foundElements.length < 4) return 2;
    return 3;
  }

  scoreDisposition(conversation) {
    const dispositionKeywords = ['field impression', 'transport', 'destination'];
    const foundElements = dispositionKeywords.filter(keyword => 
      this.checkKeywordsInConversation(this.getConversationText(conversation), [keyword])
    );

    if (foundElements.length === 0) return 0;
    if (foundElements.length < 2) return 1;
    if (foundElements.length < 3) return 2;
    return 3;
  }

  scoreLeadership(conversation) {
    const leadershipKeywords = ['delegate', 'partner', 'help', 'assist', 'teamwork'];
    const safetyKeywords = ['safety', 'hazard', 'secure'];
    
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
    return conversation
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content)
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
    let count = 0;
    const userMessages = conversation.filter(msg => msg.role === 'user');
    
    userMessages.forEach(msg => {
      if (this.checkKeywordsInConversation(msg.content, keywords)) {
        count++;
      }
    });
    
    return count;
  }

  generateSectionFeedback(conversationText, section, score) {
    const feedback = [];
    
    if (score === 0) {
      feedback.push(`${section.name} was not attempted or not evident in the conversation.`);
    } else if (score === 1) {
      feedback.push(`${section.name} was attempted but incomplete or poorly executed.`);
    } else if (score === 2) {
      feedback.push(`${section.name} was adequately performed.`);
    } else {
      feedback.push(`${section.name} was excellently performed.`);
    }

    // Add specific suggestions based on missing elements
    const keywordFound = this.checkKeywordsInConversation(conversationText, section.keywords);
    if (!keywordFound) {
      feedback.push(`Consider including: ${section.keywords.slice(0, 3).join(', ')}`);
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
