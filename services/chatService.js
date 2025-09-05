// services/chatService.js
const { openai } = require('../config/openai');
const pdfProcessor = require('./pdfProcessor');
const path = require('path');

// Import modular components
const TextNormalizer = require('./utils/textNormalizer');
const PostProcessor = require('./processors/postProcessor');
const ScenarioGenerator = require('./scenarioGenerator');
const TemplateGenerator = require('./templateGenerator');
const VitalsProcessor = require('./processors/vitalsProcessor');

// Import new AI patient/moderator systems
const PatientSimulator = require('./patientSimulator');
const ActionRecognizer = require('./actionRecognizer');
const BystanderManager = require('./bystanderManager');
const EnvironmentalManager = require('./environmentalManager');
const PerformanceEvaluator = require('./performanceEvaluator');
// Feedback mode removed per requirements

class ChatService {
  constructor() {
    this.defaultModel = 'gpt-4o-mini'; // Dispatch/short responses
    this.maxTokens = 800;
    this.temperature = 0.7;
    this.pdfContent = null;
    this.customGPTName = "EMT Scenario Trainer";
    this.customGPTDescription = "AI patient and moderator for EMT training scenarios with realistic patient simulation and performance evaluation.";
    this.scenarioGenerator = new ScenarioGenerator();
    this.templateGenerator = new TemplateGenerator();
    this.vitalsProcessor = new VitalsProcessor();
    
    // Initialize new AI patient/moderator systems
    this.patientSimulator = new PatientSimulator();
    this.actionRecognizer = new ActionRecognizer();
    this.bystanderManager = new BystanderManager();
    this.environmentalManager = new EnvironmentalManager();
    this.performanceEvaluator = new PerformanceEvaluator();
    
    // Track current scenario state
    this.currentScenarioActive = false;
    this.scenarioEndReason = null;
    
    // Feedback mode removed
  }

  // ---------- Core vital signs generation (simplified) ----------
  // Vital signs now generated through system prompt and context helpers

  // ---------- Exam flow methods (keeping original implementation) ----------
  parseExamRequest(userText) {
    const t = TextNormalizer.normalizeToAsciiLower(userText || '');
    
    // Only trigger exam flow if explicit exam keywords are present
    const examKeywords = /\b(exam|examine|assessment|assess|inspect|palpate|physical|secondary|rapid.*trauma)\b/;
    if (!examKeywords.test(t)) {
      return { type: 'focused', regions: [] }; // Return empty regions to prevent exam flow
    }
    
    let type = 'focused';
    if (/secondary/.test(t)) type = 'secondary';
    else if (/rapid.*trauma/.test(t)) type = 'rapid_trauma';

    const regionMap = {
      head: ['head', 'face', 'skull', 'brain'],
      neck: ['neck', 'throat', 'cervical'],
      chest: ['chest', 'thorax', 'ribs', 'sternum'],
      abdomen: ['abdomen', 'stomach', 'belly', 'abdominal'],
      pelvis: ['pelvis', 'pelvic', 'hip'],
      back: ['back', 'spine', 'spinal'],
      upper_extremities: ['arm', 'shoulder', 'elbow', 'wrist', 'hand'],
      lower_extremities: ['leg', 'knee', 'ankle', 'foot']
    };
    const regions = [];
    Object.entries(regionMap).forEach(([key, words]) => {
      if (words.some(w => new RegExp(`\\b${w}\\b`).test(t))) regions.push(key);
    });

    return { type, regions };
  }

  shouldStopExam(userText) {
    const t = TextNormalizer.normalizeToAsciiLower(userText || '');
    return /\b(stop|cancel) (the )?exam\b/.test(t);
  }

  getActiveExamFlow(conversation = []) {
    if (!Array.isArray(conversation)) return null;
    for (let i = conversation.length - 1; i >= 0; i--) {
      const m = conversation[i];
      if (m && m.role === 'system' && typeof m.content === 'string') {
        try {
          const obj = JSON.parse(m.content);
          if (obj && obj.type === 'examFlow') return { state: obj, index: i };
        } catch (_) { }
      }
    }
    return null;
  }

  computeExamTargetCount(type, seed) {
    if (type === 'secondary') return 5;
    if (type === 'rapid_trauma') {
      // Occasionally 4
      const n = TextNormalizer.computeDeterministicInt(String(seed || 'seed'), 0, 9);
      return n < 2 ? 4 : 5;
    }
    // Focused: generally 3, sometimes 4
    const n = TextNormalizer.computeDeterministicInt(String(seed || 'seed'), 0, 9);
    return n < 2 ? 4 : 3;
  }

  selectRegionsForExam(type, userRegions = [], scenarioData = null, targetCount = 3) {
    const defaultPool = ['head', 'neck', 'chest', 'abdomen', 'pelvis', 'back', 'upper_extremities', 'lower_extremities'];
    let pool = userRegions && userRegions.length > 0 ? [...new Set(userRegions)] : defaultPool;

    // Choose a "most critical" region to double up on when needed
    const category = this.determineScenarioCategory(scenarioData);
    let critical = 'chest';
    if (category === 'trauma') critical = 'chest';
    else if (category === 'respiratory') critical = 'chest';
    else if (category === 'metabolic') critical = 'abdomen';
    else if (category === 'cardiac') critical = 'chest';
    else if (category === 'neurologic') critical = 'head';

    const regions = [];
    // Ensure at least one pass through each named region if focused
    for (const r of pool) {
      if (regions.length >= targetCount) break;
      regions.push(r);
    }
    while (regions.length < targetCount) {
      regions.push(critical);
    }
    return regions.slice(0, targetCount);
  }

  generateExamQuestion(regionKey) {
    const templates = {
      head: 'For the head and face, name exactly what you will inspect and palpate for.',
      neck: 'For the neck, name exactly what you will inspect and palpate for.',
      chest: 'For the chest, name exactly what you will inspect and palpate for.',
      abdomen: 'For the abdomen, name exactly what you will inspect and palpate for.',
      pelvis: 'For the pelvis, name exactly what you will inspect and palpate for.',
      back: 'For the back, name exactly what you will inspect and palpate for.',
      upper_extremities: 'For the upper extremities, name exactly what you will inspect and palpate for.',
      lower_extremities: 'For the lower extremities, name exactly what you will inspect and palpate for.'
    };
    return templates[regionKey] || 'For this region, name exactly what you will inspect and palpate for.';
  }

  buildExamSummaryInstruction(type, regions) {
    const list = regions.map(r => r.replace(/_/g, ' ')).join(', ');
    return [
      'EXAM SUMMARY INSTRUCTION (STRICT):',
      `Provide a single consolidated objective summary for a ${type.replace('_', ' ')} exam covering: ${list}.`,
      '- Sentences only, no bullets, no coaching, no interpretation, no severity labels, no diagnoses.',
      '- Include only findings that were reasonably obtainable from inspection/palpation or from the user\'s answers.',
      '- Do not include lung sounds unless the user explicitly requested auscultation earlier in the conversation.',
      '- End with exactly: "Awaiting your next step."'
    ].join('\n');
  }

  // ---------- Scenario generation detection ----------
  isInitialScenarioRequest(userMessage, conversation = []) {
    // Check if this is the first message requesting a scenario
    if (!conversation || conversation.length > 0) {
      return false;
    }
    
    const t = TextNormalizer.normalizeToAsciiLower(userMessage || '');
    return (
      /\bgenerate\b/.test(t) && 
      /\bscenario\b/.test(t)
    );
  }

  // ---------- Readiness detection ----------
  isReadyIntent(userText) {
    const t = TextNormalizer.normalizeToAsciiLower(userText);
    return (
      /\bready\b/.test(t) ||
      /\bi['']?m\s*ready\b/.test(t) ||
      /\blet['']?s\s*(start|begin)\b/.test(t) ||
      /\bbegin\b/.test(t) ||
      /\bstart\b.*\btimer\b/.test(t) ||
      /\bready to begin\b/.test(t)
    );
  }

  // Detect explicit pulse oximeter usage/mention
  isPulseOxMention(userText) {
    const t = TextNormalizer.normalizeToAsciiLower(userText || '');
    return /(pulse ox|pulse oximeter|oximeter|finger probe|oxygen saturation|spo2)/.test(t);
  }





  // Detect transport decision mentions
  isTransportDecision(userText) {
    const t = TextNormalizer.normalizeToAsciiLower(userText || '');
    return /(transport|code\s*[123]|priority\s*[123]|non[- ]?emergent|emergent|lights.*sirens|to\s+(the\s+)?hospital|to\s+ed|to\s+er)/.test(t);
  }

  extractTransportDetails(userText) {
    const t = TextNormalizer.normalizeToAsciiLower(userText || '');
    const codeMatch = t.match(/(code\s*[123]|priority\s*[123]|non[- ]?emergent|emergent)/);
    const destMatch = t.match(/to\s+(the\s+)?((nearest\s+)?hospital|ed|er|emergency\s+department|[a-z ]+ hospital)/);
    const reasonMatch = t.match(/(?:for|because\s+of|due\s+to)\s+([^\.,;]+)/);
    const code = codeMatch ? codeMatch[0].replace(/\s+/g, ' ').trim() : null;
    const dest = destMatch ? destMatch[0].replace(/\s+/g, ' ').trim() : null;
    const reason = reasonMatch ? reasonMatch[1].trim() : null;
    return { code, dest, reason };
  }

  hasGeneralImpressionMarker(conversation) {
    if (!Array.isArray(conversation)) return false;
    return conversation.some((m) => m && m.role === 'system' && typeof m.content === 'string' && m.content.includes('generalImpressionShown'));
  }

  // ---------- Helper method for responses with additional context ----------
  async generateResponseWithContext(userMessage, conversation, scenarioData, additionalContext) {
    // Create messages with additional context
    const messages = await this.createMessages(userMessage, conversation, scenarioData, null, additionalContext);
    const response = await this.callOpenAI(messages);
    
    // Post-process the response
    const sanitized = PostProcessor.postProcessObjectiveContent(response, userMessage);
    
    return { 
      response: sanitized, 
      additionalMessages: [],
      enhancedScenarioData: scenarioData 
    };
  }

  // ---------- Helper method to add vital signs context ----------
  async addVitalsContext(userMessage, conversation, scenarioData) {
    const vitalsString = this.generateContextAwareVitals(conversation, scenarioData);
    
    // Detect which vitals are being requested
    const request = this.vitalsProcessor.detectVitalsRequest(userMessage);
    
    // If no vitals are being requested at all, return null
    if (!request.needsSpecification && 
        !request.isPulseOx && 
        !request.isHeartRate && 
        !request.isRespRate && 
        !request.isBloodPressure && 
        !request.isTemperature) {
      return null;
    }

    // If vitals need to be specified, ask which ones
    if (request.needsSpecification) {
      return '"Which vitals would you like me to check?"';
    }

    // Get the list of vitals being requested
    const requestedVitals = [];
    if (request.isPulseOx) requestedVitals.push('oxygen saturation');
    if (request.isHeartRate) requestedVitals.push('heart rate');
    if (request.isRespRate) requestedVitals.push('respiratory rate');
    if (request.isBloodPressure) requestedVitals.push('blood pressure');
    if (request.isTemperature) requestedVitals.push('temperature');

    // Add this context to the system message for natural response generation
    const additionalContext = `The EMT is checking your ${requestedVitals.join(', ')}. Consider your current symptoms and state when responding.`;
    
    // Create messages for the AI
    const messages = [
      { role: 'system', content: this.buildSystemMessage(scenarioData) + '\n\n' + additionalContext },
      { role: 'user', content: userMessage }
    ];

    // Get AI response
    const response = await this.callOpenAI(messages);
    
    // Format the vitals
    const parsedVitals = this.vitalsProcessor.parseVitals(vitalsString);
    const vitalsResponse = this.vitalsProcessor.formatVitalsResponse(parsedVitals, request);

    // Combine the AI response with the vitals
    return `${response}\n\n${vitalsResponse}\n\nAwaiting your next step.`;
  }

  // ---------- Helper method to generate context-aware vital signs ----------
  generateContextAwareVitals(conversation, scenarioData) {
    // Get scenario type for context
    const scenarioType = scenarioData?.subScenario?.toLowerCase() || '';
    const mainScenario = scenarioData?.mainScenario?.toLowerCase() || '';
    
    // Determine scenario category
    let category = 'general';
    if (/trauma/.test(mainScenario)) category = 'trauma';
    else if (/respiratory/.test(scenarioType)) category = 'respiratory';
    else if (/cardiac/.test(scenarioType)) category = 'cardiac';
    else if (/neuro|neurolog/.test(scenarioType)) category = 'neurologic';
    else if (/metabolic|endocrine/.test(scenarioType)) category = 'metabolic';
    
    // Generate appropriate vital signs based on category and difficulty
    const difficultyLevel = scenarioData?.generatedScenario?.difficulty?.level || 'intermediate';
    
    // Base vital signs by category
    let vitals = this.getBaseVitalsByCategory(category);
    
    // Apply difficulty modifiers
    vitals = this.applyDifficultyToVitals(vitals, difficultyLevel);
    
    // Apply intervention effects (simplified)
    vitals = this.applyInterventionEffects(vitals, conversation);
    
    // Format vital signs string
    return `HR ${vitals.heartRate}, RR ${vitals.respiratoryRate}, BP ${vitals.systolic}/${vitals.diastolic}, SpO2 ${vitals.spO2}%, Temp ${vitals.temperature.toFixed(1)}°F`;
  }

  // ---------- Helper method to get base vital signs by category ----------
  getBaseVitalsByCategory(category) {
    const baseVitals = {
      respiratory: {
        heartRate: 88,
        respiratoryRate: 24,
        systolic: 140,
        diastolic: 85,
        spO2: 89,
        temperature: 98.6
      },
      cardiac: {
        heartRate: 110,
        respiratoryRate: 20,
        systolic: 160,
        diastolic: 95,
        spO2: 92,
        temperature: 98.6
      },
      trauma: {
        heartRate: 105,
        respiratoryRate: 22,
        systolic: 145,
        diastolic: 88,
        spO2: 95,
        temperature: 98.6
      },
      neurologic: {
        heartRate: 85,
        respiratoryRate: 16,
        systolic: 130,
        diastolic: 80,
        spO2: 97,
        temperature: 98.6
      },
      metabolic: {
        heartRate: 95,
        respiratoryRate: 18,
        systolic: 135,
        diastolic: 82,
        spO2: 94,
        temperature: 98.6
      },
      general: {
        heartRate: 90,
        respiratoryRate: 18,
        systolic: 130,
        diastolic: 80,
        spO2: 96,
        temperature: 98.6
      }
    };
    
    return baseVitals[category] || baseVitals.general;
  }

  // ---------- Helper method to apply difficulty to vital signs ----------
  applyDifficultyToVitals(vitals, difficultyLevel) {
    const adjustedVitals = { ...vitals };
    
    switch (difficultyLevel) {
      case 'novice':
        // Keep vitals in more normal ranges
        adjustedVitals.spO2 = Math.max(adjustedVitals.spO2, 90);
        adjustedVitals.heartRate = Math.min(adjustedVitals.heartRate, 115);
        break;
      case 'advanced':
        // Make vitals more concerning
        adjustedVitals.spO2 = Math.min(adjustedVitals.spO2, 85);
        adjustedVitals.heartRate = Math.max(adjustedVitals.heartRate, 105);
        adjustedVitals.respiratoryRate = Math.max(adjustedVitals.respiratoryRate, 24);
        break;
    }
    
    return adjustedVitals;
  }

  // ---------- Helper method to apply intervention effects ----------
  applyInterventionEffects(vitals, conversation) {
    const adjustedVitals = { ...vitals };
    const allText = conversation.map(msg => msg.content || '').join(' ').toLowerCase();
    
    // Simple intervention detection
    if (/(oxygen|o2|nasal cannula|nc|mask|bvm)/.test(allText)) {
      adjustedVitals.spO2 += 3; // Oxygen improves SpO2
    }
    if (/(aspirin|asa)/.test(allText)) {
      adjustedVitals.heartRate -= 5; // Aspirin may lower heart rate
    }
    if (/(albuterol|ventolin|nebulizer)/.test(allText)) {
      adjustedVitals.respiratoryRate -= 2; // Bronchodilator improves breathing
      adjustedVitals.spO2 += 2;
      adjustedVitals.heartRate += 3; // Side effect
    }
    
    return adjustedVitals;
  }

  // ---------- Helper method to determine scenario category ----------
  determineScenarioCategory(scenarioData) {
    const mainRaw = TextNormalizer.normalizeToAsciiLower(scenarioData?.mainScenario || '');
    const subRaw = TextNormalizer.normalizeToAsciiLower(scenarioData?.subScenario || '');
    if (/trauma/.test(mainRaw)) return 'trauma';
    if (/respiratory/.test(subRaw)) return 'respiratory';
    if (/cardiac/.test(subRaw)) return 'cardiac';
    if (/neuro|neurolog/.test(subRaw)) return 'neurologic';
    if (/metabolic|endocrine/.test(subRaw)) return 'metabolic';
    return 'general';
  }

  // ---------- Helper method to add intervention context ----------
  addInterventionContext(userMessage, conversation, scenarioData) {
    const normalizedMessage = TextNormalizer.normalizeToAsciiLower(userMessage);
    
    // Simple intervention detection for context
    const interventions = [];
    
    if (/(oxygen|o2|nasal cannula|nc|mask|bvm|bag valve)/.test(normalizedMessage)) {
      interventions.push('oxygen therapy');
    }
    if (/(aspirin|asa)/.test(normalizedMessage)) {
      interventions.push('aspirin');
    }
    if (/(albuterol|ventolin|nebulizer|inhaler)/.test(normalizedMessage)) {
      interventions.push('albuterol');
    }
    if (/(sit.*up|upright|position)/.test(normalizedMessage)) {
      interventions.push('positioning');
    }
    if (/(iv|intravenous|fluid|saline)/.test(normalizedMessage)) {
      interventions.push('IV fluids');
    }
    if (/(epi|epinephrine|auto.*injector)/.test(normalizedMessage)) {
      interventions.push('epinephrine');
    }
    
    if (interventions.length > 0) {
      return `Intervention performed: ${interventions.join(', ')}. Respond appropriately to how you feel after this intervention.`;
    }
    
    return null;
  }

  // ---------- Helper method to add scenario evolution context ----------
  addScenarioEvolutionContext(userMessage, conversation, scenarioData) {
    // Simple scenario evolution analysis for context
    const userActions = conversation.filter(msg => msg.role === 'user');
    const conversationLength = userActions.length;
    
    // Basic time progression context
    let timeContext = '';
    if (conversationLength <= 2) {
      timeContext = 'Early in scenario - initial assessment phase';
    } else if (conversationLength <= 5) {
      timeContext = 'Assessment phase - gathering information';
    } else if (conversationLength <= 8) {
      timeContext = 'Intervention phase - providing care';
    } else {
      timeContext = 'Later in scenario - monitoring and transport phase';
    }
    
    // Check for critical interventions based on scenario type
    const scenarioType = scenarioData?.subScenario?.toLowerCase() || '';
    let criticalInterventions = [];
    
    if (scenarioType.includes('cardiac') || scenarioType.includes('chest pain')) {
      criticalInterventions = ['aspirin', 'oxygen'];
    } else if (scenarioType.includes('respiratory') || scenarioType.includes('breathing')) {
      criticalInterventions = ['oxygen', 'positioning'];
    } else if (scenarioType.includes('allergic') || scenarioType.includes('anaphylaxis')) {
      criticalInterventions = ['epinephrine', 'oxygen'];
    }
    
    // Check if critical interventions have been provided
    const allUserText = userActions.map(msg => msg.content || '').join(' ').toLowerCase();
    const providedInterventions = [];
    const missingInterventions = [];
    
    criticalInterventions.forEach(intervention => {
      if (allUserText.includes(intervention)) {
        providedInterventions.push(intervention);
      } else {
        missingInterventions.push(intervention);
      }
    });
    
    let evolutionContext = '';
    if (missingInterventions.length > 0 && conversationLength > 5) {
      evolutionContext = `Critical interventions missing: ${missingInterventions.join(', ')}. Your condition may be deteriorating.`;
    } else if (providedInterventions.length > 0) {
      evolutionContext = `Appropriate interventions provided: ${providedInterventions.join(', ')}. You should be feeling better.`;
    }
    
    return [timeContext, evolutionContext].filter(Boolean).join(' ');
  }

  // ---------- Helper method to add difficulty context ----------
  addDifficultyContext(userMessage, conversation, scenarioData) {
    // Get difficulty level from scenario data
    const difficultyLevel = scenarioData?.generatedScenario?.difficulty?.level || 'intermediate';
    
    // Add difficulty-specific context
    let difficultyContext = '';
    switch (difficultyLevel) {
      case 'novice':
        difficultyContext = 'Training mode - be cooperative and show clear improvement with interventions';
        break;
      case 'intermediate':
        difficultyContext = 'Realistic mode - show moderate anxiety and gradual improvement';
        break;
      case 'advanced':
        difficultyContext = 'Challenge mode - show high anxiety, confusion, and minimal improvement';
        break;
    }
    
    return difficultyContext;
  }

  // ---------- Feedback mode detection and handling ----------
  isFeedbackRequest(userMessage) {
    const feedbackKeywords = [
      'feedback', 'improve', 'better', 'fix', 'wrong', 'issue', 'problem',
      'age', 'gender', 'location', 'time', 'symptoms', 'medical', 'realistic'
    ];
    
    const messageLower = userMessage.toLowerCase();
    return feedbackKeywords.some(keyword => messageLower.includes(keyword));
  }

  isFeedbackModeRequest(userMessage) {
    const modeKeywords = ['feedback mode', 'feedback system', 'start feedback', 'enable feedback'];
    const messageLower = userMessage.toLowerCase();
    return modeKeywords.some(keyword => messageLower.includes(keyword));
  }

  // ---------- Main response generation method ----------
  async generateResponse(userMessage, conversation = [], scenarioData = null) {
    console.log('🔍 Starting generateResponse...');
    console.log('📝 Message length:', userMessage?.length || 0);
    console.log('🎭 Scenario data:', scenarioData);

    // Feedback mode removed

    // Check for initial scenario generation request (third priority)
    if (this.isInitialScenarioRequest(userMessage, conversation)) {
      console.log('🎭 Detected initial scenario request - generating comprehensive scenario...');
      
      // Reset all systems for new scenario
      this.resetSimulationSystems();
      
      // Initialize scenarioData if null
      if (!scenarioData) {
        const scenarioTypes = ['Cardiac Scenario', 'Respiratory Scenario', 'Trauma Scenario', 'Neurological Scenario', 'Metabolic Scenario'];
        const randomType = scenarioTypes[Math.floor(Math.random() * scenarioTypes.length)];
        scenarioData = {
          mainScenario: randomType,
          subScenario: randomType,
          scenario: randomType,
          type: randomType
        };
        console.log('🎲 Created random scenario data:', scenarioData);
      }
      
      try {
        // Try template-based approach first (more reliable)
        console.log('🎯 Attempting template-based scenario generation...');
        let attempts = 0;
        const maxAttempts = 3;
        let templateResult;
        while (attempts < maxAttempts) {
          attempts++;
          templateResult = await this.templateGenerator.generateCompleteScenario(scenarioData);
          if (!templateResult.error) break;
          console.log(`🔁 Template validation failed (attempt ${attempts})`);
        }
        
        if (!templateResult.error) {
          console.log('✅ Template-based scenario generation successful');
          
          // Store the dispatch info immediately when AI generates it
          scenarioData.dispatchInfo = templateResult.dispatchInfo;
          scenarioData.generatedScenario = templateResult; // For compatibility
          
          console.log('💾 Stored dispatch info:', scenarioData.dispatchInfo);
          
          // Generate the dispatch information and return immediately
          console.log('📝 Generating dispatch information for new scenario...');
          const dispatchContent = await PostProcessor.enforceInitialDispatchMessage('', scenarioData);
          
          // Add feedback prompt if in feedback mode
          return { 
            response: dispatchContent, 
            additionalMessages: [], 
            enhancedScenarioData: scenarioData 
          };
        }
        
        // If template approach fails after retries, return error (no auto-fallback)
        console.log('❌ Template approach failed after retries');
        return { 
          response: 'Error: Unable to generate a compliant dispatch after 3 attempts. Please try again.', 
          additionalMessages: [], 
          enhancedScenarioData: null 
        };
      } catch (error) {
        console.error('❌ Failed to generate comprehensive scenario:', error);
        return { 
          response: 'Failure to generate scenario', 
          additionalMessages: [], 
          enhancedScenarioData: null 
        };
      }
    }

    // Check for readiness intent (second priority - after scenario generation)
    if (this.isReadyIntent(userMessage) && scenarioData?.generatedScenario) {
      if (!this.hasGeneralImpressionMarker(conversation)) {
        console.log('🎬 User ready - starting patient simulation');
        
        // Initialize all simulation systems
        this.currentScenarioActive = true;
        this.patientSimulator.initializePatient(scenarioData);
        this.bystanderManager.generateBystanders(scenarioData);
        this.environmentalManager.generateEnvironmentalFactors(scenarioData);
        this.performanceEvaluator.startEvaluation(scenarioData, Date.now());
        
        const sceneImpression = await this.buildSceneOnlyImpression(scenarioData.generatedScenario);
        return { 
          response: sceneImpression, 
          additionalMessages: [{ role: 'system', content: 'generalImpressionShown' }], 
          enhancedScenarioData: scenarioData 
        };
      }
    }



    // Scenario evolution now handled by system prompt and context helpers



    // Check if scenario should end
    if (this.currentScenarioActive) {
      const endCheck = this.patientSimulator.checkScenarioEnd(userMessage);
      if (endCheck.shouldEnd) {
        console.log('⏰ Scenario ending:', endCheck.reason);
        const evaluationReport = this.performanceEvaluator.endEvaluation(Date.now(), {
          scenarioType: scenarioData?.mainScenario,
          finalVitals: endCheck.finalVitals,
          interventions: endCheck.interventions
        });
        
        this.currentScenarioActive = false;
        this.scenarioEndReason = endCheck.reason;
        
        const endMessage = endCheck.reason === 'time_expired' ? 
          'Time limit reached. Scenario complete.' : 
          'Handover received. Scenario complete.';
        
        return {
          response: `${endMessage}\n\n**PERFORMANCE SUMMARY**\n\nOverall Score: ${evaluationReport.summary.overallScore.percentage}% (${evaluationReport.summary.overallScore.points}/${evaluationReport.summary.overallScore.maxPoints})\n\n**Strengths:**\n${evaluationReport.strengths.map(s => `• ${s}`).join('\n')}\n\n**Areas for Improvement:**\n${evaluationReport.improvements.map(i => `• ${i}`).join('\n')}\n\nScenario completed in ${evaluationReport.summary.totalTime} minutes.`,
          additionalMessages: [],
          enhancedScenarioData: scenarioData
        };
      }
    }

    // Recognize and process user actions
    if (this.currentScenarioActive) {
      const recognizedAction = this.actionRecognizer.recognizeAction(userMessage);
      
      // Log action for performance evaluation
      this.performanceEvaluator.logAction(userMessage, Date.now(), recognizedAction.details);
      
      // Record interventions in patient simulator
      if (recognizedAction.type === 'medicationAdmin' || recognizedAction.type === 'equipmentUse') {
        this.patientSimulator.recordIntervention(userMessage, Date.now());
      }
      
      // Check for contraindications
      if (recognizedAction.type === 'medicationAdmin') {
        const validation = this.actionRecognizer.validateMedicationAdmin(
          recognizedAction.details, 
          scenarioData?.generatedScenario?.patientProfile
        );
        if (!validation.valid) {
          this.performanceEvaluator.logError('contraindication', validation.message, Date.now());
          return {
            response: `"Wait, I need to tell you - ${validation.message}"\n\nAwaiting your next step.`,
            additionalMessages: [],
            enhancedScenarioData: scenarioData
          };
        }
      }
      
      // Handle clarification requests
      if (recognizedAction.details.needsClarification) {
        const clarification = this.actionRecognizer.generateClarificationRequest(recognizedAction.details);
        if (clarification) {
          return {
            response: `"${clarification}"\n\nAwaiting your next step.`,
            additionalMessages: [],
            enhancedScenarioData: scenarioData
          };
        }
      }
      
      // Update patient vitals based on time progression
      this.patientSimulator.updateVitalsForTimeProgression(scenarioData);
      this.patientSimulator.updateConsciousness(scenarioData);
    }

    // Handle vital signs requests with patient simulator
    if (this.currentScenarioActive) {
      const vitalsRequest = this.vitalsProcessor.detectVitalsRequest(userMessage);
      if (vitalsRequest.isHeartRate || vitalsRequest.isBloodPressure || vitalsRequest.isRespRate || 
          vitalsRequest.isTemperature || vitalsRequest.isPulseOx) {
        
        // Collect all requested vitals
        const requestedVitals = [];
        if (vitalsRequest.isHeartRate) requestedVitals.push('heart rate');
        if (vitalsRequest.isBloodPressure) requestedVitals.push('blood pressure');
        if (vitalsRequest.isRespRate) requestedVitals.push('respiratory rate');
        if (vitalsRequest.isTemperature) requestedVitals.push('temperature');
        if (vitalsRequest.isPulseOx) requestedVitals.push('oxygen saturation');
        
        // Get all requested vitals
        const vitalResponses = requestedVitals.map(vitalType => 
          this.patientSimulator.getSpecificVital(vitalType)
        );
        
        const patientResponse = this.patientSimulator.generatePatientResponse(userMessage, scenarioData);
        
        return {
          response: `${patientResponse}\n\n${vitalResponses.join('\n')}\n\nAwaiting your next step.`,
          additionalMessages: [],
          enhancedScenarioData: scenarioData
        };
      }
      
      if (vitalsRequest.needsSpecification) {
        return {
          response: '"Which vitals would you like me to check?"\n\nAwaiting your next step.',
          additionalMessages: [],
          enhancedScenarioData: scenarioData
        };
      }
    }



    // Transport decision: note decision and repeat reason only (objective)
    if (this.isTransportDecision(userMessage)) {
      const { code, dest, reason } = this.extractTransportDetails(userMessage);
      const parts = [];
      if (code) parts.push(code);
      if (dest) parts.push(dest);
      const header = parts.length ? `Transport decision noted (${parts.join(', ')}).` : 'Transport decision noted.';
      const reasonLine = reason ? `Reason: ${reason}.` : '';
      const response = `${header}${reason ? `\n\n${reasonLine}` : ''}\n\nAwaiting your next step.`;
      return { response, additionalMessages: [], enhancedScenarioData: scenarioData };
    }

    // Guided physical exam flow
    const examRequest = this.parseExamRequest(userMessage);
    if (examRequest.type !== 'focused' || examRequest.regions.length > 0) {
      const activeFlow = this.getActiveExamFlow(conversation);

      if (this.shouldStopExam(userMessage)) {
        // Stop exam flow
        const stopMessage = { role: 'system', content: JSON.stringify({ type: 'examFlow', action: 'stop' }) };
        return { response: 'Exam stopped. Awaiting your next step.', additionalMessages: [stopMessage], enhancedScenarioData: scenarioData };
      }

      if (!activeFlow) {
        // Start new exam flow
        const targetCount = this.computeExamTargetCount(examRequest.type, userMessage);
        const regions = this.selectRegionsForExam(examRequest.type, examRequest.regions, scenarioData, targetCount);
        const startMessage = {
          role: 'system',
          content: JSON.stringify({
            type: 'examFlow',
            action: 'start',
            examType: examRequest.type,
            regions: regions,
            currentIndex: 0,
            targetCount: targetCount
          })
        };

        const firstQuestion = this.generateExamQuestion(regions[0]);
        return { response: firstQuestion, additionalMessages: [startMessage], enhancedScenarioData: scenarioData };
      } else {
        // Continue existing exam flow
        const flowState = activeFlow.state;
        const nextIndex = flowState.currentIndex + 1;

        if (nextIndex >= flowState.targetCount) {
          // Exam complete - generate summary instruction
          const summaryInstruction = this.buildExamSummaryInstruction(flowState.examType, flowState.regions);
          const completeMessage = { role: 'system', content: JSON.stringify({ type: 'examFlow', action: 'complete' }) };
          return { response: summaryInstruction, additionalMessages: [completeMessage], enhancedScenarioData: scenarioData };
        } else {
          // Continue to next region
          const nextQuestion = this.generateExamQuestion(flowState.regions[nextIndex]);
          const updateMessage = {
            role: 'system',
            content: JSON.stringify({
              type: 'examFlow',
              action: 'continue',
              examType: flowState.examType,
              regions: flowState.regions,
              currentIndex: nextIndex,
              targetCount: flowState.targetCount
            })
          };
          return { response: nextQuestion, additionalMessages: [updateMessage], enhancedScenarioData: scenarioData };
        }
      }
    }

    // Handle active scenario interactions OR conversation during any scenario
    let additionalContext = null;
    if (this.currentScenarioActive || (scenarioData?.generatedScenario && this.isPatientConversation(userMessage))) {
      console.log('🏥 Processing user interaction...', { 
        scenarioActive: this.currentScenarioActive, 
        hasScenario: !!scenarioData?.generatedScenario,
        isConversation: this.isPatientConversation(userMessage)
      });
      
      // Check if scenario should end (timeout or handover) - only if scenario is actually active
      if (this.currentScenarioActive) {
        const shouldEnd = this.patientSimulator.shouldEndScenario();
        const isHandover = this.isHandoverReport(userMessage);
        if (shouldEnd || isHandover) {
          console.log('🏁 Scenario ending...', { shouldEnd, isHandover });
          this.currentScenarioActive = false;
          this.scenarioEndReason = shouldEnd ? 'timeout' : 'handover';
          
          // Generate performance summary
          const performanceSummary = await this.generatePerformanceSummary(scenarioData);
          return {
            response: performanceSummary,
            additionalMessages: [],
            enhancedScenarioData: scenarioData
          };
        }
      }
      
      // Log user action for evaluation (only if scenario is active)
      if (this.currentScenarioActive) {
        this.performanceEvaluator.logAction(userMessage);
      }
      
      // Check if this is just conversation/introduction (not a medical action)
      const isConversation = this.isPatientConversation(userMessage);
      console.log('🔍 Conversation check:', { userMessage, isConversation });
      
      if (isConversation) {
        // Handle as natural patient conversation - no action recognition needed
        console.log('💬 Handling as patient conversation - skipping action recognition');
        additionalContext = 'PATIENT_CONVERSATION: Respond naturally as the patient to this introduction/conversation. Keep it short and in quotes.';
        // Short-circuit to ensure a patient reply even if scenario not active
        const messages = await this.createMessages(userMessage, conversation, scenarioData, null, additionalContext);
        const response = await this.callOpenAI(messages);
        let sanitized = PostProcessor.postProcessObjectiveContent(response, userMessage);
        return { response: sanitized, additionalMessages: [], enhancedScenarioData: scenarioData };
      } else {
        // Recognize and process user action
        const actionResult = this.actionRecognizer.recognizeAction(userMessage);
        console.log('🎯 Action recognized:', actionResult);
        
        // Handle medication administration with contraindications
        if (actionResult.type === 'medication') {
          const contraindication = this.patientSimulator.checkContraindications(
            actionResult.medication, 
            actionResult.dose, 
            actionResult.route
          );
          if (contraindication) {
            // Patient shows adverse reaction
            this.patientSimulator.applyIntervention(actionResult.type, actionResult, false);
            additionalContext = `CONTRAINDICATION ALERT: ${contraindication}`;
          } else {
            this.patientSimulator.applyIntervention(actionResult.type, actionResult, true);
          }
        } else if (actionResult.type !== 'unclear') {
          // Apply intervention effect
          this.patientSimulator.applyIntervention(actionResult.type, actionResult, true);
        }
        
        // Handle vitals requests specifically
        if (actionResult.type === 'vitals_check') {
          const vitalsResponse = this.patientSimulator.getRequestedVitals(actionResult.vitalsRequested);
          additionalContext = `VITALS RESPONSE: ${vitalsResponse}`;
        }
      }
      
      // Update patient state
      this.patientSimulator.updateVitals();
      this.patientSimulator.updateConsciousness();
      
      // Generate bystander interactions
      const bystanderResponse = this.bystanderManager.generateResponse(userMessage, null);
      if (bystanderResponse) {
        additionalContext = additionalContext ? 
          `${additionalContext}\n\nBYSTANDER: ${bystanderResponse}` : 
          `BYSTANDER: ${bystanderResponse}`;
      }
      
      // Generate environmental factors
      const environmentalFactor = this.environmentalManager.generateFactor();
      if (environmentalFactor) {
        additionalContext = additionalContext ? 
          `${additionalContext}\n\nENVIRONMENT: ${environmentalFactor}` : 
          `ENVIRONMENT: ${environmentalFactor}`;
      }
    }
    
    // Standard LLM response generation
    const messages = await this.createMessages(userMessage, conversation, scenarioData, null, additionalContext || null);
    const response = await this.callOpenAI(messages);

    // Post-process the response
    let sanitized = PostProcessor.postProcessObjectiveContent(response, userMessage);

    // Check if this is the first message in a scenario (no previous conversation)
    if (!conversation || conversation.length === 0) {
      sanitized = PostProcessor.enforceInitialDispatchMessage(sanitized, scenarioData);
    }

    // Add bystander response if generated
    let finalResponse = sanitized;
    if (this.currentScenarioActive) {
      const bystanderResponse = this.bystanderManager.generateBystanderResponse(userMessage, scenarioData);
      if (bystanderResponse) {
        finalResponse += `\n\n${bystanderResponse}`;
      }
      
      // Check for environmental complications
      const complication = this.bystanderManager.checkForComplications(userMessage);
      if (complication) {
        finalResponse += `\n\n*${complication}*`;
      }
    }

    return { 
      response: finalResponse, 
      additionalMessages: [],
      enhancedScenarioData: scenarioData // Pass back the enhanced scenario data
    };
  }

  // ---------- Message creation and OpenAI call ----------
  async createMessages(userMessage, conversation = [], scenarioData = null, evolutionAnalysis = null, additionalContext = null) {
    console.log('🎯 Creating messages...');

    const messages = [];

    // System message (now async)
    let systemMessage = await this.buildSystemMessage(scenarioData, evolutionAnalysis);
    
    // Add additional context if provided
    if (additionalContext) {
      console.log('🩺 System Message Debug - Adding context to system message');
      systemMessage += `\n\nADDITIONAL CONTEXT: ${additionalContext}`;
    } else {
      console.log('🩺 System Message Debug - No additional context to add');
    }
    
    // Add current vital signs for the LLM to use when responding to vitals requests
    if (scenarioData) {
      const vitalsContext = this.generateContextAwareVitals(conversation, scenarioData);
      systemMessage += `\n\nCURRENT VITAL SIGNS: ${vitalsContext}`;
    }
    
    messages.push({ role: 'system', content: systemMessage });

    // Add conversation history
    if (Array.isArray(conversation)) {
      messages.push(...conversation);
    }

    // Add user message
    messages.push({ role: 'user', content: userMessage });

    // Estimate content length
    const totalLength = messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
    console.log('📏 Estimated total content length:', totalLength);

    return messages;
  }

  async callOpenAI(messages, options = {}) {
    console.log('🚀 Calling OpenAI API...');
    const model = options.model || this.defaultModel;
    console.log('🤖 Model:', model);

    try {
      const completion = await openai.chat.completions.create({
        model: model,
        messages: messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      });

      console.log('✅ OpenAI API call successful');
      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('❌ OpenAI API call failed:', error);
      throw error;
    }
  }

  async buildSystemMessage(scenarioData = null, evolutionAnalysis = null) {
    // Load knowledge base for assessment rubric context
    const knowledgeBase = await this.loadKnowledgeBase();
    
    // Get difficulty information if available
    const difficulty = scenarioData?.generatedScenario?.difficulty;

    const basePrompt = `You are ${this.customGPTName}. ${this.customGPTDescription}

You are serving as BOTH a realistic patient AND a training moderator in an EMT scenario. Your dual role is to:
1. Respond naturally as the patient would in this medical situation
2. Provide realistic physiological responses to EMT actions
3. Simulate appropriate patient behavior based on consciousness level and condition
4. React realistically to interventions with improvement or deterioration
5. NEVER provide feedback or coaching during the scenario - only natural patient responses
6. End-of-scenario evaluation will be handled separately

IMPORTANT PATIENT SIMULATION RULES:
1. NEVER break character or mention you are an AI
2. Respond naturally as the patient would speak based on consciousness level
3. Keep responses concise and medically realistic
4. ALWAYS put patient dialogue in quotation marks
5. Show realistic responses to treatments and interventions
6. Demonstrate appropriate pain responses and symptom changes

FORMATTING REQUIREMENTS:
7. Never use second-person narration ("You observe", "You notice", "You find")
8. Avoid diagnostic terms (mild/moderate/severe distress, stable/unstable, likely, suggests)
9. Use exact numbers instead of "approximately"
10. Write in complete sentences, never bullet points
11. Only mention lung sounds (wheeze, crackles, rales) if EMT explicitly requests auscultation
12. Always end your response with "Awaiting your next step."

PATIENT BEHAVIOR BY AGE:
13. Ages 18-30: Respond quickly, use casual language ("Yeah, sure", "Go for it", "No problem")
14. Ages 31-50: Respond moderately, use standard language ("Okay", "That's fine", "Go ahead")
15. Ages 51-70: Respond more formally, show some concern ("Of course", "That's alright", "Please be careful")
16. Ages 70+: Respond slowly/gently, use endearing terms ("Alright, dear", "That's fine, honey"), may appear tired

PATIENT BEHAVIOR BY CONDITION:
17. Respiratory issues: Speak between breaths, short phrases ("Okay... just... hard to breathe", "Sure" *whispers*)
18. Cardiac issues: Show anxiety, clutch chest ("Yeah, but my chest really hurts", hand pressed to chest)
19. Neurologic issues: Show confusion, delayed responses ("I... what?", "Okay, I think", uncertain responses)
20. Trauma cases: Be protective of injuries, guarded ("Yeah, but be careful", "Okay, but it hurts")

PATIENT BEHAVIOR BY CONSCIOUSNESS:
21. Alert: Respond clearly and promptly ("Absolutely", "Of course", attentive nods)
22. Confused: Respond uncertainly, ask questions ("I'm... confused", "What's happening?")
23. Unresponsive: No verbal responses, only describe physical observations

DIFFICULTY-BASED BEHAVIOR:
24. NOVICE (Training Mode): Be cooperative and helpful. Give clear, complete answers. Show appreciation for EMT care. Respond positively to interventions and feel better when treated appropriately. Be reassuring to build student confidence. Vital signs remain stable, symptoms are clear and consistent. Show rapid improvement with any appropriate intervention.

25. INTERMEDIATE (Realistic Mode): Be moderately cooperative but show some anxiety. Give answers but may need prompting for details. Show realistic concern about your condition. Respond to interventions with gradual improvement. Be patient but occasionally ask questions. Vital signs may fluctuate, symptoms may vary slightly. Show moderate improvement with appropriate interventions.

26. ADVANCED (Challenge Mode): Be anxious, confused, or show altered mental status. Give vague or inconsistent responses that require clarification. Show high anxiety or fear. Respond slowly to interventions. Have difficulty focusing due to pain/fear. May be combative or uncooperative due to altered mental status. Vital signs are unstable and concerning, symptoms are unclear or inconsistent. Show minimal or delayed improvement even with appropriate interventions.

PRONOUN USAGE:
27. Use appropriate pronouns based on your gender in the scenario (he/him/his for male, she/her/hers for female)
28. When describing yourself in third person, use your correct gender pronouns
29. Be consistent with your gender throughout the conversation

VITAL SIGNS RESPONSES:
30. When EMT requests specific vitals (HR/heart rate, BP/blood pressure, RR/respiratory rate, Temp/temperature, SpO2/oxygen saturation): 
   - First provide a natural patient acknowledgment (see ACKNOWLEDGMENT STYLE below)
   - Then provide ONLY the requested specific vitals
   - Example: "Check my heart rate" → "Okay, go ahead." [then provide HR only]
   - Example: "Get BP and temperature" → "Sure, that's fine." [then provide BP and Temp only]

31. When EMT requests "vitals" or "vital signs" generically (without specifying which):
   - Ask "Which vitals would you like me to check?"
   - Do NOT provide any vitals until they specify

32. When EMT mentions pulse oximeter, oxygen saturation, or finger probe:
   - Respond naturally as the patient would to having a device placed on their finger
   - The system will automatically provide SpO2 readings - acknowledge the reading naturally

33. When EMT mentions transport decision or code: Acknowledge the transport choice appropriately

ACKNOWLEDGMENT STYLE:
34. Generate appropriate patient acknowledgments based on scenario type and difficulty:
   - Respiratory scenarios: Short, breathless phrases ("Okay... go ahead", "Sure... do it")
   - Cardiac scenarios: Anxious, hurried phrases ("Okay, please hurry", "Alright, that's fine")  
   - Trauma scenarios: Cautious, protective phrases ("Okay, but please be careful", "Alright, please be gentle")
   - Neurologic scenarios: Confused, uncertain phrases ("Um... okay, I think", "Okay... that's fine")
   - Metabolic scenarios: Cooperative phrases ("Sure, that's fine", "Okay, go ahead")
   - General scenarios: Simple phrases ("Okay", "Alright", "Sure")

35. Difficulty-based acknowledgment tone:
   - NOVICE: Cooperative and warm ("Okay, thank you", "Sure, that's fine")
   - INTERMEDIATE: Neutral and standard ("Okay", "Alright")
   - ADVANCED: Anxious or short ("Okay... please be quick", "Okay...")

36. Always put acknowledgments in quotation marks and end with appropriate punctuation

INTERVENTION RESPONSES:
37. When EMT gives oxygen therapy (nasal cannula, mask, BVM): Show improvement in breathing and SpO2, feel more comfortable
38. When EMT gives aspirin for chest pain: Show gradual improvement in chest pain and anxiety
39. When EMT gives albuterol/nebulizer: Show improvement in breathing, may have slight increased heart rate as side effect
40. When EMT positions you upright: Show improvement in breathing and comfort
41. When EMT gives IV fluids: Show improvement in overall condition and energy
42. When EMT gives epinephrine: Show rapid improvement in severe symptoms
43. Show deterioration if critical interventions are delayed or missed
44. Respond to intervention quality - better technique = better results

RESPONSE GUIDELINES:
45. If asked about symptoms, describe them as the patient would
46. If asked about medical history, respond as the patient would
47. If asked about medications, respond as the patient would
48. If asked about allergies, respond as the patient would
49. For physical exams: React appropriately to being touched, examined, or having equipment used
50. Cooperate with medical procedures unless your condition prevents it

CONVERSATION AND INTRODUCTION HANDLING:
51. When EMT introduces themselves: Respond naturally as the patient would, acknowledging their presence
52. When EMT says "Hi" or greets you: Respond with appropriate patient greeting based on your condition
53. When EMT asks "what's the problem": Describe your chief complaint and current symptoms
54. NEVER ask for clarification on introductions, greetings, or basic conversation
55. Always respond in character as the patient, even for simple interactions
56. Example responses to "Hi I'm John, I'm an EMT":
    - Alert patient: "Oh thank goodness you're here! I'm really worried about..."
    - Anxious patient: "Please help me, I don't know what's happening..."
    - Confused patient: "Who... who are you? I'm so confused..."

SCENARIO EVOLUTION:
57. Show natural progression of your condition based on time and interventions
58. If critical interventions are delayed: Show gradual deterioration (increased symptoms, decreased cooperation)
59. If appropriate interventions are given: Show improvement (decreased symptoms, increased cooperation)
60. If inappropriate interventions are given: Show no improvement or slight worsening
61. Show complications if critical interventions are missed (e.g., cardiac arrest if aspirin delayed for chest pain)
62. Respond to intervention quality - better technique = better results
63. Show realistic time-based changes (condition may worsen if untreated for too long)
64. Maintain consistency with your initial presentation and medical condition

VITAL SIGNS GENERATION:
59. Generate realistic vital signs based on your medical condition and scenario type
60. Cardiac conditions: Show elevated heart rate, blood pressure changes, normal to slightly low SpO2
61. Respiratory conditions: Show elevated respiratory rate, decreased SpO2, normal heart rate
62. Trauma conditions: Show elevated heart rate, normal to elevated blood pressure, normal SpO2
63. Neurologic conditions: Show normal vital signs unless severe, may have altered mental status
64. Metabolic conditions: Show variable vital signs based on specific condition
65. Show vital sign changes based on interventions (oxygen improves SpO2, aspirin may lower heart rate)
66. Maintain realistic ranges: HR 40-200, RR 8-50, BP 60/40-250/150, SpO2 70-100%, Temp 95-106°F
67. Show gradual improvement or deterioration based on intervention quality and timing

SCENARIO CONTEXT:`;

    let systemMessage = '';
    if (scenarioData) {
      systemMessage = `${basePrompt}
Main Scenario: ${scenarioData.mainScenario || 'Medical Scenario'}
Sub Scenario: ${scenarioData.subScenario || 'General Medical'}
Patient ID: ${scenarioData.sunetId || 'Unknown'}`;

      // Add comprehensive scenario details if available
      if (scenarioData.generatedScenario) {
        const gs = scenarioData.generatedScenario;
        systemMessage += `

DETAILED PATIENT INFORMATION:
- Age: ${gs.patientProfile?.age || 'Unknown'} years old
- Gender: ${gs.patientProfile?.gender || 'Unknown'}
- Medical History: ${gs.patientProfile?.medicalHistory?.join(', ') || 'Unknown'}
- Current Medications: ${gs.patientProfile?.medications?.join(', ') || 'None known'}
- Allergies: ${gs.patientProfile?.allergies?.join(', ') || 'NKDA'}
- Chief Complaint: ${gs.presentation?.chiefComplaint || 'Unknown'}
- Symptom Onset: ${gs.presentation?.onsetTime || 'Unknown'}
- Current Condition: ${gs.physicalFindings?.consciousness || 'Alert'}

You are this specific patient. Respond consistently with this medical profile and current condition.`;
      }

      systemMessage += `\n\nRespond as the patient in this scenario.`;
    } else {
      systemMessage = `${basePrompt}
General medical scenario. Respond as the patient would.`;
    }

    // Add current difficulty level instruction
    if (difficulty) {
      const difficultyLevel = difficulty.level.toUpperCase();
      systemMessage += `\n\nCURRENT DIFFICULTY: ${difficultyLevel} - Follow the ${difficultyLevel} difficulty behavior guidelines above.`;
    }

    // Add scenario evolution context
    if (evolutionAnalysis) {
      systemMessage += `\n\nSCENARIO EVOLUTION CONTEXT:
${this.buildEvolutionContext(evolutionAnalysis)}`;
    }

    // Add knowledge base context if available (for assessment awareness)
    if (knowledgeBase && Object.keys(knowledgeBase).length > 0) {
      const rubricSummary = this.extractRubricSummary(knowledgeBase);
      if (rubricSummary) {
        systemMessage += `\n\nASSESSMENT CONTEXT (for realistic patient responses):\n${rubricSummary}`;
      }
    }

    return systemMessage;
  }

  buildEvolutionContext(evolutionAnalysis) {
    const { progression, nextEvolution } = evolutionAnalysis;
    let context = `Current Phase: ${progression.currentPhase.toUpperCase()}`;
    context += `\nTime Elapsed: ${Math.round(progression.timeElapsed)} minutes`;
    
    if (nextEvolution.type !== 'stable') {
      context += `\nEvolution Status: ${nextEvolution.type.toUpperCase()} (${nextEvolution.intensity})`;
      
      if (nextEvolution.changes.length > 0) {
        context += `\nActive Changes:`;
        nextEvolution.changes.forEach(change => {
          context += `\n- ${change.type}: ${change.change}`;
        });
      }
      
      if (nextEvolution.triggers.length > 0) {
        const urgentTriggers = nextEvolution.triggers.filter(t => t.urgency === 'high');
        if (urgentTriggers.length > 0) {
          context += `\nUrgent: ${urgentTriggers[0].description}`;
        }
      }
    }
    
    // Add intervention quality feedback
    if (progression.interventionQuality.overall !== 'adequate') {
      context += `\nIntervention Quality: ${progression.interventionQuality.overall}`;
      if (progression.interventionQuality.missingCritical.length > 0) {
        context += ` (Missing: ${progression.interventionQuality.missingCritical.join(', ')})`;
      }
    }
    
    context += `\n\nAdjust your patient responses to reflect this evolution state.`;
    return context;
  }

  // Extract relevant rubric information for patient role-playing context
  extractRubricSummary(knowledgeBase) {
    try {
      const summaryParts = [];

      for (const [name, data] of Object.entries(knowledgeBase)) {
        if (name.toLowerCase().includes('rubric')) {
          // Extract key assessment areas for patient context
          const content = data.content.toLowerCase();

          if (content.includes('primary assessment') || content.includes('scene safety')) {
            summaryParts.push('Patients should respond appropriately to EMT scene safety and primary assessment procedures.');
          }

          if (content.includes('airway') || content.includes('breathing') || content.includes('circulation')) {
            summaryParts.push('Patients may have varying levels of consciousness and ability to respond to ABC assessment.');
          }
        }
      }

      return summaryParts.length > 0 ? summaryParts.join(' ') : null;
    } catch (error) {
      console.error('Error extracting rubric summary:', error);
      return null;
    }
  }

  // ---------- Knowledge base loading ----------
  async loadKnowledgeBase() {
    console.log('📖 Loading knowledge base...');

    if (this.pdfContent) {
      console.log('📚 Knowledge base already loaded');
      return this.pdfContent;
    }

    try {
      const pdfDir = path.join(__dirname, '../knowledge/pdfs');
      this.pdfContent = await pdfProcessor.loadKnowledgeBase(pdfDir);
      console.log('✅ Knowledge base loaded successfully');
      return this.pdfContent;
    } catch (error) {
      console.error('❌ Failed to load knowledge base:', error);
      return null;
    }
  }

  // ---------- Additional required methods ----------
  async getAvailableModels() {
    try {
      const models = await openai.models.list();
      return models.data.map(model => model.id).filter(id => id.includes('gpt'));
    } catch (error) {
      console.error('❌ Failed to get available models:', error);
      return [this.defaultModel];
    }
  }

  /**
   * Get EMT interventions for a scenario
   * @param {Object} scenarioData - Scenario data with generated interventions
   * @returns {Object} - EMT intervention recommendations
   */
  getEmtInterventions(scenarioData) {
    const interventions = scenarioData?.generatedScenario?.emtInterventions;
    
    if (!interventions) {
      console.log('ℹ️  No EMT interventions available for this scenario');
      return null;
    }

    console.log('🚑 Retrieved EMT interventions for scenario');
    return {
      immediate: interventions.immediate || [],
      primary: interventions.primary || [],
      monitoring: interventions.monitoring || [],
      contraindications: interventions.contraindications || [],
      medications: interventions.medications || [],
      equipment: interventions.equipment || [],
      transportDecision: interventions.transportDecision || 'Standard BLS transport'
    };
  }

  async generateScoredFeedback(conversation, scenarioData) {
    try {
      const feedbackPrompt = `Based on the following EMT scenario conversation, provide structured feedback and scoring:

Scenario: ${scenarioData?.mainScenario || 'Medical'} - ${scenarioData?.subScenario || 'General'}

Conversation:
${conversation.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Please provide:
1. Overall assessment (1-10 scale)
2. Key strengths
3. Areas for improvement
4. Specific recommendations
5. Final score and justification

Format as JSON with keys: assessment, strengths, improvements, recommendations, score, justification`;

      const messages = [
        { role: 'system', content: 'You are an expert EMT instructor providing structured feedback.' },
        { role: 'user', content: feedbackPrompt }
      ];

      const response = await this.callOpenAI(messages);

      try {
        return JSON.parse(response);
      } catch (parseError) {
        return {
          assessment: 'Unable to parse feedback',
          strengths: [],
          improvements: [],
          recommendations: [],
          score: 5,
          justification: 'Error parsing feedback response'
        };
      }
    } catch (error) {
      console.error('❌ Failed to generate scored feedback:', error);
      return {
        assessment: 'Error generating feedback',
        strengths: [],
        improvements: [],
        recommendations: [],
        score: 0,
        justification: 'Technical error occurred'
      };
    }
  }

  /**
   * Reset all simulation systems for a new scenario
   */
  resetSimulationSystems() {
    this.currentScenarioActive = false;
    this.scenarioEndReason = null;
    this.patientSimulator.reset();
    this.bystanderManager.reset();
    this.environmentalManager.reset();
    this.performanceEvaluator.reset();
    console.log('🔄 All simulation systems reset for new scenario');
  }

  /**
   * Detect if user message is patient conversation rather than medical action
   */
  isPatientConversation(userMessage) {
    const message = userMessage.toLowerCase().trim();
    
    // Introduction patterns
    const introPatterns = [
      /^(hi|hello|hey)\b/,
      /\bi'?m\s+\w+/,  // "I'm John", "I'm a paramedic"
      /my name is/,
      /\bcall me\b/,
      /\bintroduce\b/,
      /\bemt\b.*\bhere\b/,
      /\bparamedic\b.*\bhere\b/,
      /\bwith\s+(the\s+)?ambulance/,
      /\bwe'?re\s+here\s+to\s+help/,
      /\bhow\s+are\s+you\s+(doing|feeling)/,
      /\bwhat'?s\s+your\s+name/,
      /\bcan\s+you\s+tell\s+me\s+your\s+name/
    ];
    
    // Conversational patterns
    const conversationPatterns = [
      /\bhow\s+old\s+are\s+you/,
      /\bwhat\s+happened/,
      /\bcan\s+you\s+tell\s+me\s+what/,
      /\bwhen\s+did\s+this\s+start/,
      /\bhave\s+you\s+had\s+this\s+before/,
      /\bare\s+you\s+allergic/,
      /\bdo\s+you\s+take\s+any\s+medications/,
      /\bwhat\s+medications/,
      /\bany\s+medical\s+history/,
      /\bwhere\s+does\s+it\s+hurt/,
      /\bwhat\s+does\s+the\s+pain\s+feel\s+like/,
      /\bon\s+a\s+scale\s+of/,
      /\brate\s+your\s+pain/,
      /\bwhat\s+seems\s+to\s+be\s+the\s+problem/,
      /\bwhat'?s\s+the\s+problem/,
      /\bwhat'?s\s+going\s+on/,
      /\bwhat'?s\s+wrong/,
      /\bcan\s+i\s+help\s+you\b/,
      /\bcan\s+i\s+assist\s+you\b/
    ];
    
    // Check if it matches conversation patterns
    const isConversation = [...introPatterns, ...conversationPatterns].some(pattern => 
      pattern.test(message)
    );
    
    // Not conversation if it contains clear medical action words
    const actionWords = [
      'check', 'take', 'get', 'obtain', 'measure', 'listen', 'feel', 'palpate',
      'vitals', 'pulse', 'blood pressure', 'bp', 'heart rate', 'hr', 'temperature',
      'oxygen', 'o2', 'spo2', 'respiratory rate', 'rr', 'breathing',
      'iv', 'medication', 'drug', 'give', 'administer', 'inject',
      'transport', 'move', 'lift', 'position', 'immobilize'
    ];
    
    const hasActionWords = actionWords.some(word => message.includes(word));
    
    return isConversation && !hasActionWords;
  }

  /**
   * Build only the scene description (general impression) when the user says they're ready
   * @param {Object} generatedScenario - The AI-generated scenario data
   * @returns {string} - Scene description only, no patient dialogue
   */
  async buildSceneOnlyImpression(generatedScenario) {
    try {
      const { patientProfile, physicalFindings, dispatchInfo, presentation } = generatedScenario;
      
      // Extract key data for the AI to use
      const age = patientProfile?.age || 'unknown age';
      const gender = patientProfile?.gender || 'unknown gender';
      const location = dispatchInfo?.location || 'the scene';
      const appearance = physicalFindings?.generalAppearance || 'appears to be in mild distress';
      const consciousness = physicalFindings?.consciousness || 'alert';
      const breathing = physicalFindings?.breathing || 'normal';
      const skin = physicalFindings?.skin || 'normal';
      const chiefComplaint = presentation?.chiefComplaint || 'unknown complaint';
      
      // Create a prompt for the AI to generate a natural scene description
      const systemPrompt = `You are an EMT instructor creating a realistic initial scene description for a training scenario. 
Generate a brief, objective description of what the EMT sees when first arriving on scene.
Follow these STRICT guidelines:
- Start with "You arrive at [location]."
- Describe only what is visually observable
- Be concise and clinical, but natural
- No dialogue or patient statements
- No medical assessment or diagnosis
- No treatment recommendations
- End with "Awaiting your next step."
- Maximum 3 sentences total for the description (plus the "Awaiting your next step." line)`;

      const userPrompt = `Create an initial scene description with these details:
- Location: ${location}
- Patient: ${age}-year-old ${gender}
- Appearance: ${appearance}
- Consciousness: ${consciousness}
- Breathing: ${breathing}
- Skin: ${skin}
- Chief complaint: ${chiefComplaint}`;

      // Call OpenAI to generate the scene description
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
      
      // Use higher-quality model for scene generation
      const response = await this.callOpenAI(messages, { model: 'gpt-4o' });
      
      // Ensure the response ends with "Awaiting your next step."
      let impression = response;
      if (!impression.endsWith('Awaiting your next step.')) {
        impression += '\n\nAwaiting your next step.';
      }
      
      return impression;
    } catch (error) {
      console.error('❌ Error building scene impression:', error);
      // Fall back to a simple template if AI generation fails
      return `You arrive on scene and encounter a patient.\n\nAwaiting your next step.`;
    }
  }


}

module.exports = ChatService;