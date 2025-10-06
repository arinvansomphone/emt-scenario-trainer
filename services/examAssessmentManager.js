// services/examAssessmentManager.js
const TextNormalizer = require('./utils/textNormalizer');

class ExamAssessmentManager {
  constructor() {
    this.questionBank = this.initializeQuestionBank();
    this.activeAssessments = new Map(); // Track ongoing assessments per session
    this.assessmentResults = new Map(); // Store completed assessment results
  }

  // Initialize comprehensive question bank for different exam types
  initializeQuestionBank() {
    return {
      // Focused Physical Exam Questions (body region specific)
      focusedChest: {
        examType: 'Focused Physical Exam - Chest',
        questions: [
          {
            id: 'chest_anatomy',
            category: 'anatomy',
            type: 'scenario_general',
            question: 'What specific anatomical structures are you examining during a focused chest assessment?',
            expectedElements: ['ribs', 'sternum', 'intercostal spaces', 'clavicles', 'lung fields', 'heart', 'chest wall'],
            scenarioVariant: 'For this chest pain patient, what anatomical structures are you focusing on during your chest examination?'
          },
          {
            id: 'chest_pathology',
            category: 'pathology',
            type: 'scenario_specific',
            question: 'What abnormal signs are you looking for when examining the chest of a patient with chest pain and shortness of breath?',
            expectedElements: ['unequal chest rise', 'use of accessory muscles', 'cyanosis', 'wheezing', 'rales', 'decreased breath sounds', 'chest pain on palpation', 'irregular heart rhythm'],
            generalVariant: 'What abnormal findings might you discover during chest inspection, palpation, and auscultation?'
          },
          {
            id: 'chest_technique',
            category: 'technique',
            type: 'general',
            question: 'Where exactly do you place your stethoscope for a complete bilateral lung assessment?',
            expectedElements: ['upper lobes bilaterally', 'middle lobes', 'lower lobes bilaterally', 'anterior', 'posterior', 'mid-axillary', 'systematic approach'],
            scenarioVariant: 'Describe the specific locations where you would auscultate this patient\'s lungs.'
          },
          {
            id: 'chest_inspection',
            category: 'technique',
            type: 'general',
            question: 'What do you observe during visual inspection of the chest before palpation and auscultation?',
            expectedElements: ['chest wall symmetry', 'respiratory rate', 'breathing pattern', 'use of accessory muscles', 'skin color', 'visible deformities', 'chest rise equality'],
            scenarioVariant: 'What visual signs would you look for when first exposing this patient\'s chest?'
          }
        ]
      },

      focusedAbdomen: {
        examType: 'Focused Physical Exam - Abdomen',
        questions: [
          {
            id: 'abdomen_anatomy',
            category: 'anatomy',
            type: 'general',
            question: 'What are the four quadrants of the abdomen and what major organs are located in each?',
            expectedElements: ['RUQ: liver, gallbladder, right kidney', 'LUQ: spleen, stomach, left kidney', 'RLQ: appendix, right ovary', 'LLQ: sigmoid colon, left ovary', 'quadrant system'],
            scenarioVariant: 'Based on this patient\'s complaint, which abdominal quadrants and organs are you focusing on?'
          },
          {
            id: 'abdomen_pathology',
            category: 'pathology',
            type: 'scenario_general',
            question: 'What abnormal signs are you looking for during abdominal examination?',
            expectedElements: ['guarding', 'rigidity', 'tenderness', 'distension', 'masses', 'abnormal bowel sounds', 'rebound tenderness', 'discoloration'],
            scenarioVariant: 'For this patient with abdominal pain, what specific abnormal findings are you assessing for?'
          },
          {
            id: 'abdomen_technique',
            category: 'technique',
            type: 'general',
            question: 'What is the correct sequence for abdominal examination and why?',
            expectedElements: ['inspect first', 'auscultate second', 'palpate last', 'light palpation before deep', 'avoid stimulating bowel sounds', 'systematic approach'],
            scenarioVariant: 'Describe the proper technique sequence you would use to examine this patient\'s abdomen.'
          },
          {
            id: 'abdomen_palpation',
            category: 'technique',
            type: 'general',
            question: 'How do you properly palpate all four quadrants of the abdomen?',
            expectedElements: ['start away from pain', 'light then deep palpation', 'use fingertips', 'systematic quadrant approach', 'watch patient face', 'gentle pressure'],
            scenarioVariant: 'Explain your palpation technique for examining this patient\'s abdominal pain.'
          }
        ]
      },

      rapidTrauma: {
        examType: 'Rapid Trauma Assessment',
        questions: [
          {
            id: 'rapid_purpose',
            category: 'anatomy',
            type: 'general',
            question: 'What body regions must be assessed during a rapid trauma examination?',
            expectedElements: ['head', 'neck', 'chest', 'abdomen', 'pelvis', 'upper extremities', 'lower extremities', 'posterior'],
            scenarioVariant: 'For this trauma patient, which body regions are you rapidly assessing for life-threatening injuries?'
          },
          {
            id: 'rapid_pathology',
            category: 'pathology',
            type: 'scenario_general',
            question: 'What life-threatening injuries are you looking for during a rapid trauma assessment?',
            expectedElements: ['airway obstruction', 'tension pneumothorax', 'hemothorax', 'massive hemorrhage', 'flail chest', 'pelvic instability', 'spinal injuries', 'open fractures'],
            scenarioVariant: 'Based on the mechanism of injury for this patient, what critical injuries are you rapidly screening for?'
          },
          {
            id: 'rapid_technique',
            category: 'technique',
            type: 'general',
            question: 'How do you complete a rapid trauma assessment within the 120-second time limit?',
            expectedElements: ['systematic head-to-toe', 'look and feel simultaneously', 'prioritize life threats', 'minimal time per region', 'expose areas', 'palpate for deformities'],
            scenarioVariant: 'Describe your systematic approach for rapidly assessing this trauma patient efficiently.'
          },
          {
            id: 'rapid_findings',
            category: 'technique',
            type: 'general',
            question: 'What are you feeling for when palpating during a rapid trauma exam?',
            expectedElements: ['deformities', 'crepitus', 'instability', 'tenderness', 'swelling', 'step-offs', 'abnormal movement'],
            scenarioVariant: 'What specific abnormalities would you palpate for in this trauma patient?'
          }
        ]
      },

      fullSecondary: {
        examType: 'Full Secondary Assessment',
        questions: [
          {
            id: 'secondary_purpose',
            category: 'anatomy',
            type: 'general',
            question: 'What is the difference between a rapid trauma exam and a full secondary assessment?',
            expectedElements: ['more detailed examination', 'identify minor injuries', 'complete head-to-toe', 'after life threats addressed', 'includes neurological assessment', 'more time per region'],
            scenarioVariant: 'Now that initial life threats are managed, what additional assessment are you performing on this patient?'
          },
          {
            id: 'secondary_head',
            category: 'technique',
            type: 'general',
            question: 'What specific elements do you assess during a detailed head and neck examination?',
            expectedElements: ['scalp palpation', 'facial symmetry', 'pupil assessment', 'oral cavity', 'neck palpation', 'tracheal position', 'jugular veins', 'cervical spine'],
            scenarioVariant: 'Describe your detailed head and neck assessment for this patient.'
          },
          {
            id: 'secondary_extremities',
            category: 'technique',
            type: 'general',
            question: 'What do you assess when examining each extremity during a full secondary exam?',
            expectedElements: ['distal circulation', 'sensation', 'motor function', 'deformities', 'swelling', 'range of motion', 'skin integrity', 'bilateral comparison'],
            scenarioVariant: 'Explain your systematic approach to examining this patient\'s extremities for injury.'
          },
          {
            id: 'secondary_neurological',
            category: 'pathology',
            type: 'scenario_general',
            question: 'What neurological assessments are included in a full secondary examination?',
            expectedElements: ['mental status', 'glasgow coma scale', 'pupil response', 'motor response', 'sensory response', 'reflexes', 'coordination', 'speech'],
            scenarioVariant: 'What neurological signs are you assessing in this patient during your detailed examination?'
          },
          {
            id: 'secondary_posterior',
            category: 'technique',
            type: 'general',
            question: 'How do you safely examine the posterior aspect of a patient during a full secondary assessment?',
            expectedElements: ['log roll technique', 'spinal precautions', 'multiple providers', 'posterior thorax', 'lumbar spine', 'buttocks', 'maintain alignment'],
            scenarioVariant: 'Describe how you would safely examine the back of this patient while maintaining spinal precautions.'
          }
        ]
      }
    };
  }

  // Detect if user wants to perform a physical exam
  detectExamIntent(userMessage) {
    const normalized = TextNormalizer.normalizeToAsciiLower(userMessage);
    
    // Focused exam patterns
    const focusedPatterns = [
      /(?:perform|do|conduct)\s+(?:a\s+)?focused\s+(?:physical\s+)?exam/,
      /(?:want\s+to\s+)?(?:perform|do|examine)\s+(?:a\s+)?focused\s+(?:assessment|exam)/,
      /focused\s+(?:physical\s+)?(?:exam|assessment)/
    ];

    // Rapid trauma patterns
    const rapidPatterns = [
      /(?:perform|do|conduct)\s+(?:a\s+)?rapid\s+(?:trauma\s+)?(?:exam|assessment)/,
      /rapid\s+(?:trauma\s+)?(?:exam|assessment|survey)/,
      /(?:want\s+to\s+)?(?:perform|do)\s+(?:a\s+)?rapid\s+(?:physical\s+)?exam/
    ];

    // Full secondary patterns
    const secondaryPatterns = [
      /(?:perform|do|conduct)\s+(?:a\s+)?(?:full\s+)?secondary\s+(?:exam|assessment)/,
      /(?:full\s+)?secondary\s+(?:exam|assessment|survey)/,
      /(?:want\s+to\s+)?(?:perform|do)\s+(?:a\s+)?(?:full\s+)?secondary\s+(?:physical\s+)?exam/,
      /detailed\s+(?:physical\s+)?(?:exam|assessment)/
    ];

    // Detect body region for focused exams
    const bodyRegions = {
      chest: /\b(?:chest|thorax|lung|respiratory|breathing|heart|cardiac)\b/,
      abdomen: /\b(?:abdomen|abdominal|belly|stomach|gut)\b/,
      head: /\b(?:head|skull|cranial|face|facial)\b/,
      neck: /\b(?:neck|cervical|throat)\b/,
      extremities: /\b(?:arm|leg|extremity|extremities|limb|hand|foot)\b/,
      back: /\b(?:back|spine|spinal|posterior)\b/,
      pelvis: /\b(?:pelvis|pelvic|hip)\b/
    };

    // Check for focused exam
    if (focusedPatterns.some(pattern => pattern.test(normalized))) {
      for (const [region, pattern] of Object.entries(bodyRegions)) {
        if (pattern.test(normalized)) {
          return {
            type: 'focused',
            region: region,
            examKey: `focused${region.charAt(0).toUpperCase() + region.slice(1)}`,
            detected: true
          };
        }
      }
      // Default focused to chest if no specific region mentioned
      return {
        type: 'focused',
        region: 'chest',
        examKey: 'focusedChest',
        detected: true
      };
    }

    // Check for rapid trauma
    if (rapidPatterns.some(pattern => pattern.test(normalized))) {
      return {
        type: 'rapid',
        region: 'full_body',
        examKey: 'rapidTrauma',
        detected: true
      };
    }

    // Check for full secondary
    if (secondaryPatterns.some(pattern => pattern.test(normalized))) {
      return {
        type: 'secondary',
        region: 'full_body',
        examKey: 'fullSecondary',
        detected: true
      };
    }

    return { detected: false };
  }

  // Start a new exam assessment
  startExamAssessment(sessionId, examIntent, scenarioData) {
    const examKey = examIntent.examKey;
    
    // Handle region variations for focused exams
    let questionSet = this.questionBank[examKey];
    
    // If focused exam region not in bank, use chest as default and adapt
    if (!questionSet && examIntent.type === 'focused') {
      questionSet = this.questionBank.focusedChest;
    }

    if (!questionSet) {
      console.error(`No question set found for exam: ${examKey}`);
      return null;
    }

    // Select 3-5 questions randomly from the set, ensuring coverage of all categories
    const selectedQuestions = this.selectQuestionsForAssessment(questionSet.questions, scenarioData);
    
    const assessment = {
      sessionId,
      examType: questionSet.examType,
      examKey,
      examIntent,
      questions: selectedQuestions,
      currentQuestionIndex: 0,
      answers: [],
      startTime: Date.now(),
      scenarioData
    };

    this.activeAssessments.set(sessionId, assessment);
    console.log(`📋 Started exam assessment: ${questionSet.examType} for session ${sessionId}`);
    
    return assessment;
  }

  // Select appropriate questions ensuring category coverage
  selectQuestionsForAssessment(questions, scenarioData) {
    const categories = ['anatomy', 'pathology', 'technique'];
    const selected = [];
    
    // Ensure at least one question from each category
    categories.forEach(category => {
      const categoryQuestions = questions.filter(q => q.category === category);
      if (categoryQuestions.length > 0) {
        const randomIndex = Math.floor(Math.random() * categoryQuestions.length);
        selected.push(categoryQuestions[randomIndex]);
      }
    });

    // Add 1-2 additional random questions to reach 3-5 total
    const remaining = questions.filter(q => !selected.includes(q));
    const additionalCount = Math.min(2, Math.max(0, 5 - selected.length));
    
    for (let i = 0; i < additionalCount && remaining.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * remaining.length);
      selected.push(remaining.splice(randomIndex, 1)[0]);
    }

    // Randomize final order
    return selected.sort(() => Math.random() - 0.5);
  }

  // Get the current question for an active assessment
  getCurrentQuestion(sessionId) {
    const assessment = this.activeAssessments.get(sessionId);
    if (!assessment) return null;

    const question = assessment.questions[assessment.currentQuestionIndex];
    if (!question) return null;

    // Choose scenario-specific or general version based on scenario data
    const useScenarioVariant = assessment.scenarioData && question.type.includes('scenario');
    const questionText = useScenarioVariant && question.scenarioVariant ? 
      question.scenarioVariant : question.question;

    return {
      questionNumber: assessment.currentQuestionIndex + 1,
      totalQuestions: assessment.questions.length,
      questionText,
      questionId: question.id,
      category: question.category
    };
  }

  // Submit an answer to the current question
  submitAnswer(sessionId, answerText) {
    const assessment = this.activeAssessments.get(sessionId);
    if (!assessment) return null;

    const currentQuestion = assessment.questions[assessment.currentQuestionIndex];
    if (!currentQuestion) return null;

    // Store the answer
    const answer = {
      questionId: currentQuestion.id,
      questionText: currentQuestion.question,
      category: currentQuestion.category,
      answer: answerText,
      timestamp: Date.now(),
      expectedElements: currentQuestion.expectedElements
    };

    assessment.answers.push(answer);
    assessment.currentQuestionIndex++;

    console.log(`📝 Answer submitted for ${currentQuestion.id}: ${answerText.substring(0, 100)}...`);

    // Check if assessment is complete
    if (assessment.currentQuestionIndex >= assessment.questions.length) {
      return this.completeAssessment(sessionId);
    }

    return { status: 'continue', nextQuestion: this.getCurrentQuestion(sessionId) };
  }

  // Complete the assessment and generate results
  completeAssessment(sessionId) {
    const assessment = this.activeAssessments.get(sessionId);
    if (!assessment) return null;

    // Grade the assessment
    const results = this.gradeAssessment(assessment);
    
    // Store results for later grading integration
    this.assessmentResults.set(sessionId, results);
    
    // Remove from active assessments
    this.activeAssessments.delete(sessionId);

    console.log(`✅ Completed exam assessment: ${assessment.examType}, Score: ${results.overallScore}%`);

    return { 
      status: 'complete', 
      results,
      examType: assessment.examType,
      examKey: assessment.examKey
    };
  }

  // Grade the assessment based on completeness and accuracy
  gradeAssessment(assessment) {
    const categoryScores = {
      anatomy: { score: 0, maxScore: 0 },
      pathology: { score: 0, maxScore: 0 },
      technique: { score: 0, maxScore: 0 }
    };

    let totalScore = 0;
    let maxTotalScore = 0;

    assessment.answers.forEach(answer => {
      const category = answer.category;
      const score = this.gradeAnswer(answer.answer, answer.expectedElements);
      
      categoryScores[category].score += score;
      categoryScores[category].maxScore += 3; // Max 3 points per question
      
      totalScore += score;
      maxTotalScore += 3;
    });

    const overallScore = maxTotalScore > 0 ? Math.round((totalScore / maxTotalScore) * 100) : 0;

    const results = {
      sessionId: assessment.sessionId,
      examType: assessment.examType,
      examKey: assessment.examKey,
      totalQuestions: assessment.questions.length,
      categoryScores,
      overallScore,
      totalScore,
      maxTotalScore,
      completionTime: Date.now() - assessment.startTime,
      answers: assessment.answers.map(answer => ({
        ...answer,
        score: this.gradeAnswer(answer.answer, answer.expectedElements)
      }))
    };

    return results;
  }

  // Grade individual answer based on expected elements
  gradeAnswer(answerText, expectedElements) {
    if (!answerText || !expectedElements) return 0;

    const normalizedAnswer = TextNormalizer.normalizeToAsciiLower(answerText);
    let matchCount = 0;

    expectedElements.forEach(element => {
      const normalizedElement = TextNormalizer.normalizeToAsciiLower(element);
      if (normalizedAnswer.includes(normalizedElement)) {
        matchCount++;
      }
    });

    // Score based on percentage of expected elements mentioned
    const completeness = matchCount / expectedElements.length;
    
    if (completeness >= 0.8) return 3; // Excellent
    if (completeness >= 0.6) return 2; // Good
    if (completeness >= 0.4) return 1; // Fair
    return 0; // Poor
  }

  // Check if user has an active assessment
  hasActiveAssessment(sessionId) {
    return this.activeAssessments.has(sessionId);
  }

  // Get assessment results for grading integration
  getAssessmentResults(sessionId) {
    return this.assessmentResults.get(sessionId);
  }

  // Generate acknowledgment message for exam intent
  generateAcknowledgmentMessage(examIntent) {
    const examTypeMessages = {
      focused: `I'll guide you through a focused physical examination assessment. This will help evaluate your knowledge before providing examination findings.`,
      rapid: `I'll guide you through a rapid trauma assessment evaluation. This will test your knowledge of systematic trauma examination before providing findings.`,
      secondary: `I'll guide you through a full secondary assessment evaluation. This will assess your understanding of detailed examination techniques before providing findings.`
    };

    const baseMessage = examTypeMessages[examIntent.type] || examTypeMessages.focused;
    
    if (examIntent.region && examIntent.region !== 'full_body') {
      return `${baseMessage}\n\nFocus area: ${examIntent.region.charAt(0).toUpperCase() + examIntent.region.slice(1)}`;
    }

    return baseMessage;
  }

  // Clear assessment data for session (cleanup)
  clearSessionData(sessionId) {
    this.activeAssessments.delete(sessionId);
    this.assessmentResults.delete(sessionId);
  }
}

module.exports = new ExamAssessmentManager();

