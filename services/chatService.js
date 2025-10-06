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

// Import grading and scenario ending systems
const GradingEngine = require('./gradingEngine');
const ScenarioEndingManager = require('./scenarioEndingManager');
const ExamAssessmentManager = require('./examAssessmentManager');
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
    this.gradingEngine = GradingEngine;
    this.scenarioEndingManager = ScenarioEndingManager;
    this.examAssessmentManager = ExamAssessmentManager;

    // Physical exam guided flow is fully removed
    
    // Track current scenario state
    this.currentScenarioActive = false;
    this.scenarioStartTime = null;
    this.scenarioEndReason = null;
    
    // Feedback mode removed
  }

  // ---------- Core vital signs generation (simplified) ----------
  // Vital signs now generated through system prompt and context helpers

  shouldStopExam(userText) {
    if (!this.physicalExamEnabled) return false;
    const t = TextNormalizer.normalizeToAsciiLower(userText || '');
    return /\b(stop|cancel) (the )?exam\b/.test(t);
  }

  getActiveExamFlow(conversation = []) {
    if (!this.physicalExamEnabled) return null;
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
    if (!this.physicalExamEnabled) return 0;
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
    if (!this.physicalExamEnabled) return [];
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
    if (!this.physicalExamEnabled) return 'Exam questions are disabled.';
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
    if (!this.physicalExamEnabled) return 'Exam summary is disabled.';
    const list = regions.map(r => r.replace(/_/g, ' ')).join(', ');
    return [
      'EXAM SUMMARY INSTRUCTION (STRICT):',
      `Provide a single consolidated objective summary for a ${type.replace('_', ' ')} exam covering: ${list}.`,
      '- Sentences only, no bullets, no coaching, no interpretation, no severity labels, no diagnoses.',
      '- Include only findings that were reasonably obtainable from inspection/palpation or from the user\'s answers.',
      '- Do not include lung sounds unless the user explicitly requested auscultation earlier in the conversation.',
      '- End with exactly: "\\n\\nAwaiting your next step."'
    ].join('\n');
  }

  // ---------- Immediate region-check findings (simple, objective) ----------
  detectRegionChecks(userText) {
    const t = TextNormalizer.normalizeToAsciiLower(userText || '');
    const trigger = /(check|assess|examine|inspect|palpate|look at|look\s+over|evaluate)/;
    if (!trigger.test(t)) return [];

    const regionMap = {
      head: [/\bhead\b/, /\bface\b/, /\bscalp\b/],
      neck: [/\bneck\b/, /\bc-spine\b/, /\bcervical\b/],
      chest: [/\bchest\b/, /\bthorax\b/, /\bribs?\b/],
      abdomen: [/\babdomen\b/, /\bstomach\b/, /\bbelly\b/],
      pelvis: [/\bpelvis\b/, /\bpelvic\b/, /\bhips?\b/],
      back: [/\bback\b/, /\bspine\b/, /\blumbar\b/],
      upper_extremities: [/\bupper\s+extremit/ , /\barms?\b/, /\bshoulders?\b/, /\belbows?\b/, /\bwrists?\b/, /\bhands?\b/],
      lower_extremities: [/\blower\s+extremit/, /\blegs?\b/, /\bknees?\b/, /\bankles?\b/, /\bfeet\b|\bfoot\b/]
    };

    const regions = [];
    Object.entries(regionMap).forEach(([key, patterns]) => {
      if (patterns.some((p) => p.test(t))) regions.push(key);
    });
    return [...new Set(regions)];
  }

  generateRegionFinding(regionKey, scenarioData) {
    const category = this.determineScenarioCategory(scenarioData);
    const byCategory = {
      abdominal: {
        head: 'No trauma; normal appearance.',
        neck: 'Supple; trachea midline.',
        chest: 'Equal chest rise; breathing unlabored at rest.',
        abdomen: this.generateAbdomenFindings(scenarioData),
        pelvis: 'Stable and non-tender.',
        back: 'No midline tenderness.',
        upper_extremities: 'No deformities; pulses intact.',
        lower_extremities: 'No deformities; pulses intact.'
      },
      neurologic: {
        head: 'Mild right-sided facial droop and slurred speech; pupils equal and reactive; no scalp trauma.',
        neck: 'Neck supple, trachea midline, no tenderness.',
        chest: 'Breathing unlabored, equal chest rise, clear breath sounds bilaterally.',
        abdomen: 'Abdomen soft and non-tender, no guarding or distension.',
        pelvis: 'Pelvis stable on gentle compression, no tenderness.',
        back: 'No spinal tenderness or step-offs.',
        upper_extremities: 'Grip strength weaker on the right; no deformities or swelling.',
        lower_extremities: 'Right leg shows slight drift; distal pulses intact and equal.'
      },
      respiratory: {
        head: 'No facial trauma; speaking in short phrases.',
        neck: 'Trachea midline; no JVD at rest.',
        chest: 'Increased work of breathing; scattered wheezes bilaterally.',
        abdomen: 'Soft, non-tender.',
        pelvis: 'Stable, non-tender.',
        back: 'No tenderness noted.',
        upper_extremities: 'No edema; capillary refill brisk.',
        lower_extremities: 'No edema; distal pulses intact.'
      },
      cardiac: {
        head: 'No focal deficits; appears anxious.',
        neck: 'Possible mild JVD when semi-reclined.',
        chest: 'Chest wall non-tender; breath sounds clear; patient reports chest pressure.',
        abdomen: 'Soft, non-tender.',
        pelvis: 'Stable, non-tender.',
        back: 'No CVA tenderness.',
        upper_extremities: 'Skin cool and slightly diaphoretic.',
        lower_extremities: 'No edema; distal pulses present.'
      },
      trauma: {
        head: 'No skull depression; minor abrasions; pupils equal and reactive.',
        neck: 'Midline tenderness absent; C-spine maintained.',
        chest: 'Chest wall symmetric; no crepitus; breath sounds equal.',
        abdomen: 'Soft, non-distended; no focal tenderness.',
        pelvis: 'Stable on gentle compression; no pain.',
        back: 'No step-offs; no tenderness.',
        upper_extremities: 'No obvious deformities; pulses and sensation intact.',
        lower_extremities: 'No deformities; pulses and sensation intact.'
      },
      metabolic: {
        head: 'Appears confused; no trauma; pupils equal and reactive.',
        neck: 'Supple; no tenderness.',
        chest: 'Breath sounds clear bilaterally.',
        abdomen: 'Soft, non-tender.',
        pelvis: 'Stable.',
        back: 'No tenderness.',
        upper_extremities: 'Fine tremor present; capillary refill brisk.',
        lower_extremities: 'No edema; distal pulses intact.'
      },
      general: {
        head: 'No trauma; normal appearance.',
        neck: 'Supple; trachea midline.',
        chest: 'Equal chest rise; clear breath sounds bilaterally.',
        abdomen: 'Soft and non-tender.',
        pelvis: 'Stable and non-tender.',
        back: 'No midline tenderness.',
        upper_extremities: 'No deformities; pulses intact.',
        lower_extremities: 'No deformities; pulses intact.'
      }
    };

    const table = byCategory[category] || byCategory.general;
    const baseFinding = table[regionKey] || 'No notable findings.';
    return this.applySymptomConsistency(regionKey, baseFinding, scenarioData);
  }

  formatRegionFindings(regions, scenarioData) {
    const labelMap = {
      head: 'Head/Face',
      neck: 'Neck',
      chest: 'Chest',
      abdomen: 'Abdomen',
      pelvis: 'Pelvis',
      back: 'Back',
      upper_extremities: 'Upper Extremities',
      lower_extremities: 'Lower Extremities'
    };

    const lines = regions.map((r) => `${labelMap[r] || r}: ${this.generateRegionFinding(r, scenarioData)}`);
    return lines.join('\n');
  }

  // Generate abdomen findings that align with patient-reported symptoms
  generateAbdomenFindings(scenarioData) {
    try {
      const symptomText = (
        scenarioData?.dispatchInfo?.symptoms ||
        scenarioData?.generatedScenario?.presentation?.chiefComplaint ||
        ''
      ).toLowerCase();

      const hasPain = /abdominal pain|stomach pain|belly pain|tender|hurts|pain in (the )?abdomen|guarding/.test(symptomText);
      const hasFever = /fever|febrile|chills|temperature/.test(symptomText);
      const hasNauseaVomiting = /nausea|vomit|vomiting|retch/.test(symptomText);
      const rlq = /(rlq|right lower quadrant|appendix|appendic)/.test(symptomText);
      const ruq = /(ruq|right upper quadrant|gallbladder|biliary|cholecyst)/.test(symptomText);
      const luq = /(luq|left upper quadrant|spleen|splenic)/.test(symptomText);
      const llq = /(llq|left lower quadrant|diverticul|ovarian|cyst|torsion)/.test(symptomText);

      const quadrant = rlq ? 'RLQ' : ruq ? 'RUQ' : luq ? 'LUQ' : llq ? 'LLQ' : null;

      // If pain is reported, reflect tenderness/guarding appropriately
      if (hasPain) {
        const tenderness = quadrant ? `${quadrant} tenderness` : 'localized tenderness';
        const peritoneal = hasFever || hasNauseaVomiting ? ' with mild guarding' : '';
        const distension = /distend|bloated/.test(symptomText) ? ' mild distension,' : '';
        return `Abdomen ${distension ? 'shows' + distension : 'flat,'} ${tenderness}${peritoneal}; no rebound noted.`;
      }

      // Default general abdominal finding when no pain keywords present
      return 'Abdomen soft and non-tender.';
    } catch (_) {
      return 'Abdomen soft and non-tender.';
    }
  }

  // Adjust any region's finding to align with reported symptoms to avoid contradictions
  applySymptomConsistency(regionKey, baseFinding, scenarioData) {
    try {
      const symptomText = (
        scenarioData?.dispatchInfo?.symptoms ||
        scenarioData?.generatedScenario?.presentation?.chiefComplaint ||
        ''
      ).toLowerCase();

      // Helper for simple matches
      const has = (re) => re.test(symptomText);

      switch (regionKey) {
        case 'abdomen':
          return this.generateAbdomenFindings(scenarioData);
        case 'chest': {
          if (has(/\b(short(ness)?\s*of\s*breath|sob|dyspnea|trouble\s*breathing|breathless|difficulty\s*breathing)\b/)) {
            return 'Increased work of breathing; equal chest rise.';
          }
          if (has(/\b(rib|chest wall|impact|contusion|blunt|penetrating|trauma|fall|mvc)\b/)) {
            return 'Chest wall tenderness to palpation; symmetric chest rise.';
          }
          return baseFinding;
        }
        case 'pelvis': {
          if (has(/\b(pelvic|hip|groin)\s+(pain|tender|injur|fracture)\b/) || has(/\b(trauma|fall|mvc)\b/)) {
            return 'Pelvis tender on gentle compression; no gross instability.';
          }
          return baseFinding;
        }
        case 'back': {
          if (has(/\b(back|lumbar|thoracic)\s+(pain|tender|spasm|injur)\b/)) {
            return 'Paraspinal tenderness; no midline step-offs.';
          }
          return baseFinding;
        }
        case 'neck': {
          if (has(/\b(neck|c[-\s]?spine|cervical)\s+(pain|tender|stiff|injur|whiplash)\b/)) {
            return 'Cervical tenderness on palpation; trachea midline.';
          }
          return baseFinding;
        }
        case 'head': {
          if (has(/\b(headache|head\s*pain|migraine|hit\s+my\s+head|head\s*trauma)\b/)) {
            return 'Tenderness over scalp/temples; pupils equal and reactive.';
          }
          if (has(/\b(confus|slurr|stroke|neuro|aphasia|weakness)\b/)) {
            return 'Subtle facial asymmetry with delayed responses; pupils equal and reactive.';
          }
          return baseFinding;
        }
        case 'upper_extremities': {
          if (has(/\b(arm|shoulder|elbow|wrist|hand)\b.*\b(pain|tender|injur|swelling)\b/) || has(/\b(fracture|sprain)\b/)) {
            return 'Tenderness over affected upper extremity; pulses and sensation intact.';
          }
          return baseFinding;
        }
        case 'lower_extremities': {
          if (has(/\b(leg|knee|ankle|foot)\b.*\b(pain|tender|injur|swelling)\b/) || has(/\b(fracture|sprain)\b/)) {
            return 'Tenderness over affected lower extremity; pulses and sensation intact.';
          }
          if (has(/\b(edema|swelling)\b.*\b(legs?|ankles?|feet)\b/)) {
            return 'Bilateral pitting edema at ankles; distal pulses intact.';
          }
          return baseFinding;
        }
        default:
          return baseFinding;
      }
    } catch (_) {
      return baseFinding;
    }
  }

  // ---------- Detect and respond to pulse/skin quality checks ----------
  detectPulseSkinRequest(userText) {
    const t = TextNormalizer.normalizeToAsciiLower(userText || '');
    const wantsPulse = /(check|assess|feel|palpate|grab).*(radial|wrist|pulse)/.test(t) || /(pulse).*(quality|rate|regular|strong)/.test(t);
    const wantsSkin = /(check|assess|look at|inspect).*(skin)/.test(t) || /(cap(illary)?\s*refill|crt)/.test(t);
    const wantsAck = /(do\s+you\s+mind|is\s+it\s+(ok|okay|alright)|can\s+i|may\s+i|okay\s+if|ok\s+if|alright\s+if)/.test(t) || /\?\s*$/.test(t);
    return { wantsPulse, wantsSkin, wantsAck, any: wantsPulse || wantsSkin };
  }

  formatPulseSkinResponse(pulseSkinReq, scenarioData) {
    const lines = [];
    if (pulseSkinReq.wantsAck) {
      lines.push(`"${this.generateSimpleAcknowledgment(scenarioData)}"`);
    }
    if (pulseSkinReq.wantsPulse) {
      // Use patient simulator HR if available
      try {
        const hrLine = this.patientSimulator.getSpecificVital('heart rate');
        lines.push('Radial pulse: regular and strong.');
        if (hrLine) lines.push(hrLine);
      } catch (_) {
        lines.push('Radial pulse: regular and strong.');
      }
    }

    if (pulseSkinReq.wantsSkin) {
      const symptoms = (scenarioData?.dispatchInfo?.symptoms || scenarioData?.generatedScenario?.presentation?.chiefComplaint || '').toLowerCase();
      const hasFever = /fever|febrile|hot/.test(symptoms);
      const skinDesc = hasFever ? 'warm and slightly diaphoretic' : 'warm and dry';
      lines.push(`Skin: ${skinDesc}. Capillary refill brisk (<2 seconds).`);
    }

    return lines.join('\n');
  }

  generateSimpleAcknowledgment(scenarioData) {
    const category = this.determineScenarioCategory(scenarioData);
    switch (category) {
      case 'respiratory':
        return 'Okay... go ahead.';
      case 'cardiac':
        return "Alright, that's fine.";
      case 'trauma':
        return 'Okay, but please be careful.';
      case 'neurologic':
        return "Um... okay, I think.";
      case 'metabolic':
        return "Sure, that's fine.";
      default:
        return "Okay, go ahead.";
    }
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
    const t = TextNormalizer.normalizeToAsciiLower(userText || '');
    // Only treat explicit, standalone readiness phrases as readiness.
    // Avoid matching words like "begin" inside history questions.
    const explicitReady = /^(?:\s*i['’]?m\s*)?ready\s*$/i.test(t);
    const letsStart = /\blet['’]?s\s*(start|begin)\b/.test(t);
    const startTimer = /\bstart\b.*\btimer\b/.test(t);
    const readyToBegin = /\bready\s+to\s+begin\b/.test(t);
    const standaloneBegin = /^(?:\s*begin(?:\s+(?:the\s+)?(?:scenario|case))?)\s*$/i.test(t);
    return explicitReady || letsStart || startTimer || readyToBegin || standaloneBegin;
  }

  // Detect explicit pulse oximeter usage/mention
  isPulseOxMention(userText) {
    const t = TextNormalizer.normalizeToAsciiLower(userText || '');
    return /(pulse ox|pulse oximeter|oximeter|finger probe|oxygen saturation|spo2)/.test(t);
  }





  // Detect transport decision mentions
  isTransportDecision(userText) {
    const t = TextNormalizer.normalizeToAsciiLower(userText || '');
    // Only treat as transport decision when explicitly stated. Avoid matching casual phrases like
    // "get you to the hospital" which appear in patient reassurance.
    const explicitTransportTo = /\btransport(?:ing)?\s+to\s+(the\s+)?(hospital|ed|er|emergency\s+department)\b/.test(t);
    const codeOrPriority = /(\bcode\s*[123]\b|\bpriority\s*[123]\b)/.test(t);
    const decisionPhrase = /\btransport\s+decision\b/.test(t);
    const lightsSirens = /\blights?.*sirens\b/.test(t);
    const emergentWord = /\bnon[- ]?emergent\b|\bemergent\b/.test(t);
    return explicitTransportTo || codeOrPriority || decisionPhrase || lightsSirens || emergentWord;
  }

  extractTransportDetails(userText) {
    const t = TextNormalizer.normalizeToAsciiLower(userText || '');
    const codeMatch = t.match(/(code\s*[123]|priority\s*[123]|non[- ]?emergent|emergent)/);
    // Destination only when explicitly phrased as "transport to ..."
    const destMatch = t.match(/transport(?:ing)?\s+to\s+(the\s+)?((nearest\s+)?hospital|ed|er|emergency\s+department|[a-z\s]+ hospital)/);
    const reasonMatch = t.match(/(?:for|because\s+of|due\s+to)\s+([^\.,;]+)/);
    const code = codeMatch ? codeMatch[0].replace(/\s+/g, ' ').trim() : null;
    const dest = destMatch ? destMatch[0].replace(/^transport(?:ing)?\s+to\s+(the\s+)?/, '').replace(/\s+/g, ' ').trim() : null;
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
    const sanitized = PostProcessor.postProcessObjectiveContent(response, userMessage, scenarioData);
    
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
    if (/abdominal|abdomen|gi|gastro|stomach/.test(subRaw)) return 'abdominal';
    if (/neuro|neurolog/.test(subRaw)) return 'neurologic';
    if (/metabolic|endocrine/.test(subRaw)) return 'metabolic';
    return 'general';
  }

  // Force end scenario for testing
  forceEndScenario(userMessage, conversation, scenarioData) {
    // Force end with timeout reason
    const sessionId = this.generateSessionId(conversation);
    const examAssessmentResults = this.examAssessmentManager.getAssessmentResults(sessionId);
    
    // Get start time from either memory or persisted data
    const startTime = this.scenarioStartTime || scenarioData?.meta?.startTime || Date.now() - 6*60*1000;
    const timeSpent = this.scenarioEndingManager.calculateTimeSpent(startTime);
    
    const endingCheck = {
      shouldEnd: true,
      reason: 'timeout',
      trigger: 'Time limit reached (forced)',
      timeSpent: timeSpent,
      userMessage
    };
    
    // Generate comprehensive grading using EMED111 rubric
    const gradingResults = this.gradingEngine.gradeScenario(
      conversation, 
      scenarioData, 
      timeSpent,
      examAssessmentResults
    );
    
    // Generate detailed feedback report
    const feedbackReport = this.gradingEngine.generateFeedbackReport(gradingResults, scenarioData);
    
    // End simulation systems
    this.currentScenarioActive = false;
    this.scenarioEndReason = endingCheck.reason;
    
    // Generate ending response
    const endingResponse = this.scenarioEndingManager.generateEndingResponse(endingCheck, userMessage);
    
    // Create comprehensive feedback
    const feedbackMessage = this.formatFeedbackMessage(feedbackReport, endingCheck);
    
    return {
      response: `${endingResponse}\n\n${feedbackMessage}`,
      additionalMessages: [{ role: 'system', content: 'scenarioEnded' }],
      enhancedScenarioData: { ...scenarioData, gradingResults, feedbackReport }
    };
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
          
          // Initialize meta object with time limit
          if (!scenarioData.meta) scenarioData.meta = {};
          scenarioData.meta.timeLimitMinutes = this.scenarioEndingManager.TIME_LIMIT_MINUTES;
          
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
        this.scenarioStartTime = Date.now();
        // Persist start time in scenarioData to survive server restarts
        if (!scenarioData.meta) scenarioData.meta = {};
        scenarioData.meta.startTime = this.scenarioStartTime;
        scenarioData.meta.timeLimitMinutes = this.scenarioEndingManager.TIME_LIMIT_MINUTES;
        this.patientSimulator.initializePatient(scenarioData);
        this.bystanderManager.generateBystanders(scenarioData);
        this.environmentalManager.generateEnvironmentalFactors(scenarioData);
        this.performanceEvaluator.startEvaluation(scenarioData, this.scenarioStartTime);
        
        const sceneImpression = await this.buildSceneOnlyImpression(scenarioData.generatedScenario);
        return { 
          response: sceneImpression, 
          additionalMessages: [{ role: 'system', content: 'generalImpressionShown' }], 
          enhancedScenarioData: scenarioData 
        };
      }
    }



    // Scenario evolution now handled by system prompt and context helpers



    // Check if scenario should end (new EMED111 grading system)
    {
      // Use persisted start time if in-memory value was lost (e.g., server restart)
      const startTime = this.scenarioStartTime || scenarioData?.meta?.startTime || null;
      const endingCheck = startTime
        ? this.scenarioEndingManager.checkForScenarioEnding(userMessage, conversation, startTime)
        : { shouldEnd: false, timeSpent: 0 };
      
      if (endingCheck.shouldEnd) {
        console.log('⏰ Scenario ending:', endingCheck.reason, `(${endingCheck.timeSpent} minutes)`);
        
        // Get exam assessment results if any
        const sessionId = this.generateSessionId(conversation);
        const examAssessmentResults = this.examAssessmentManager.getAssessmentResults(sessionId);
        
        // Generate comprehensive grading using EMED111 rubric
        const gradingResults = this.gradingEngine.gradeScenario(
          conversation, 
          scenarioData, 
          endingCheck.timeSpent,
          examAssessmentResults
        );
        
        // Generate detailed feedback report
        const feedbackReport = this.gradingEngine.generateFeedbackReport(gradingResults, scenarioData);
        
        // End simulation systems
        this.currentScenarioActive = false;
        this.scenarioEndReason = endingCheck.reason;
        
        // Generate ending response
        const endingResponse = this.scenarioEndingManager.generateEndingResponse(endingCheck, userMessage);
        
        // Create comprehensive feedback
        const feedbackMessage = this.formatFeedbackMessage(feedbackReport, endingCheck);
        
        return {
          response: `${endingResponse}\n\n${feedbackMessage}`,
          additionalMessages: [{ role: 'system', content: 'scenarioEnded' }],
          enhancedScenarioData: { ...scenarioData, gradingResults, feedbackReport }
        };
      }
      
      // Time warnings disabled per requirements
    }

    // Recognize and process user actions
    if (this.currentScenarioActive) {
      // Early conversation handling: if the user is introducing themselves or
      // engaging in simple conversation, force a patient reply BEFORE any
      // action recognition to avoid unnecessary clarification prompts.
      const earlyConversationCheck = this.isPatientConversation(userMessage);
      if (earlyConversationCheck.isPureConversation) {
        console.log('💬 Handling introduction/conversation before action recognition');
        const additionalContext = 'PATIENT_CONVERSATION: Respond naturally as the patient to this introduction/conversation. Keep it short and in quotes.';
        const messages = await this.createMessages(userMessage, conversation, scenarioData, null, additionalContext);
        const response = await this.callOpenAI(messages);
        let sanitized = PostProcessor.postProcessObjectiveContent(response, userMessage, scenarioData);
        return { response: sanitized, additionalMessages: [], enhancedScenarioData: scenarioData };
      }

      // Check for physical exam assessment intent
      const examIntent = this.examAssessmentManager.detectExamIntent(userMessage);
      if (examIntent.detected) {
        console.log('📋 Physical exam assessment detected:', examIntent);
        return await this.handleExamAssessment(userMessage, conversation, scenarioData, examIntent);
      }

      // Check for ongoing exam assessment responses
      const sessionId = this.generateSessionId(conversation);
      if (this.examAssessmentManager.hasActiveAssessment(sessionId)) {
        console.log('📝 Processing exam assessment answer');
        return await this.handleExamAssessmentAnswer(userMessage, conversation, scenarioData, sessionId);
      }

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

    // Handle equipment placement with automatic readings
    if (this.currentScenarioActive) {
      const equipmentPlacement = this.detectEquipmentPlacement(userMessage);
      if (equipmentPlacement.detected) {
        const patientResponse = this.patientSimulator.generatePatientResponse(userMessage, scenarioData);
        
        let response = patientResponse;
        
        // Automatically provide readings for monitoring equipment
        if (equipmentPlacement.providesReading) {
          const reading = this.patientSimulator.getSpecificVital(equipmentPlacement.readingType);
          response += `\n\n${reading}`;
        }
        
        response += '\n\nAwaiting your next step.';
        
        return {
          response,
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

    // Guided physical exam flow removed

    // Handle active scenario interactions OR conversation during any scenario
    let additionalContext = null;
    const conversationCheckForScenario = this.isPatientConversation(userMessage);
    if (this.currentScenarioActive || (scenarioData?.generatedScenario && conversationCheckForScenario.isConversation)) {
      console.log('🏥 Processing user interaction...', { 
        scenarioActive: this.currentScenarioActive, 
        hasScenario: !!scenarioData?.generatedScenario,
        conversationCheck: conversationCheckForScenario
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
      
      // Check if this is conversation and/or action
      const conversationCheck = this.isPatientConversation(userMessage);
      console.log('🔍 Conversation check:', { userMessage, conversationCheck });
      
      // Recognize and process any medical action
      let actionResult = null;
      let actionContext = '';
      
      if (conversationCheck.hasActionWords) {
        actionResult = this.actionRecognizer.recognizeAction(userMessage);
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
            actionContext = `CONTRAINDICATION ALERT: ${contraindication}`;
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
          actionContext = `VITALS RESPONSE: ${vitalsResponse}`;
        }
      }
      
      // Determine the primary context for the AI
      if (conversationCheck.isPureConversation) {
        // Pure conversation - just patient response
        console.log('💬 Handling as pure patient conversation');
        additionalContext = 'PATIENT_CONVERSATION: Respond naturally as the patient to this introduction/conversation. Keep it short and in quotes.';
      } else if (conversationCheck.isConversation && conversationCheck.hasActionWords) {
        // Hybrid: speaking to patient AND performing action
        console.log('🔀 Handling as hybrid conversation + action');
        additionalContext = `HYBRID_INTERACTION: The EMT is both speaking to the patient AND performing an assessment/action. Provide BOTH: 1) A brief patient response in quotes, 2) The objective assessment finding. ${actionContext}`;
      } else {
        // Pure action - just assessment result
        console.log('🎯 Handling as action only');
        additionalContext = actionContext;
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

    // Pulse/Skin quality quick response (priority over region checks)
    const pulseSkinReq = this.detectPulseSkinRequest(userMessage);
    if (pulseSkinReq.any) {
      const findings = this.formatPulseSkinResponse(pulseSkinReq, scenarioData);
      const response = `${findings}\n\nAwaiting your next step.`;
      return { response, additionalMessages: [], enhancedScenarioData: scenarioData };
    }

    // Immediate region findings when user checks/assesses body parts
    const regionChecks = this.detectRegionChecks(userMessage);
    if (regionChecks.length > 0) {
      const findings = this.formatRegionFindings(regionChecks, scenarioData);
      const response = `${findings}\n\nAwaiting your next step.`;
      return { response, additionalMessages: [], enhancedScenarioData: scenarioData };
    }

    // Standard LLM response generation
    const messages = await this.createMessages(userMessage, conversation, scenarioData, null, additionalContext || null);
    const response = await this.callOpenAI(messages);

    // Post-process the response
    let sanitized = PostProcessor.postProcessObjectiveContent(response, userMessage, scenarioData);

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
      
      // Time warnings disabled per requirements
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
5. CRITICAL: Any narrative descriptions (actions, observations, physical changes) MUST be in THIRD PERSON, not first person
   - CORRECT: *The patient starts to feel more comfortable as the oxygen flows*
   - CORRECT: *She breathes more easily and her anxiety decreases*
   - WRONG: *I start to feel more comfortable as the oxygen flows*
   - WRONG: *As the oxygen is placed on my face, I feel better*
6. Show realistic responses to treatments and interventions
7. Demonstrate appropriate pain responses and symptom changes

FORMATTING REQUIREMENTS:
8. Never use second-person narration ("You observe", "You notice", "You find")
9. Avoid diagnostic terms (mild/moderate/severe distress, stable/unstable, likely, suggests)
10. Use exact numbers instead of "approximately"
11. Write in complete sentences, never bullet points
12. Only mention lung sounds (wheeze, crackles, rales) if EMT explicitly requests auscultation
13. Always end your response with "\n\nAwaiting your next step."

PATIENT BEHAVIOR BY AGE:
14. Ages 18-30: Respond quickly, use casual language ("Yeah, sure", "Go for it", "No problem")
15. Ages 31-50: Respond moderately, use standard language ("Okay", "That's fine", "Go ahead")
16. Ages 51-70: Respond more formally, show some concern ("Of course", "That's alright", "Please be careful")
17. Ages 70+: Respond slowly/gently, use endearing terms ("Alright, dear", "That's fine, honey"), may appear tired

PATIENT BEHAVIOR BY CONDITION:
18. Respiratory issues: Speak between breaths, short phrases ("Okay... just... hard to breathe", "Sure" *whispers*)
19. Cardiac issues: Show anxiety, clutch chest ("Yeah, but my chest really hurts", hand pressed to chest)
20. Neurologic issues: Show confusion, delayed responses ("I... what?", "Okay, I think", uncertain responses)
21. Trauma cases: Be protective of injuries, guarded ("Yeah, but be careful", "Okay, but it hurts")

PATIENT BEHAVIOR BY CONSCIOUSNESS:
22. Alert: Respond clearly and promptly ("Absolutely", "Of course", attentive nods)
23. Confused: Respond uncertainly, ask questions ("I'm... confused", "What's happening?")
24. Unresponsive: No verbal responses, only describe physical observations

DIFFICULTY-BASED BEHAVIOR:
25. NOVICE (Training Mode): Be cooperative and helpful. Give clear, complete answers. Show appreciation for EMT care. Respond positively to interventions and feel better when treated appropriately. Be reassuring to build student confidence. Vital signs remain stable, symptoms are clear and consistent. Show rapid improvement with any appropriate intervention.

26. INTERMEDIATE (Realistic Mode): Be moderately cooperative but show some anxiety. Give answers but may need prompting for details. Show realistic concern about your condition. Respond to interventions with gradual improvement. Be patient but occasionally ask questions. Vital signs may fluctuate, symptoms may vary slightly. Show moderate improvement with appropriate interventions.

27. ADVANCED (Challenge Mode): Be anxious, confused, or show altered mental status. Give vague or inconsistent responses that require clarification. Show high anxiety or fear. Respond slowly to interventions. Have difficulty focusing due to pain/fear. May be combative or uncooperative due to altered mental status. Vital signs are unstable and concerning, symptoms are unclear or inconsistent. Show minimal or delayed improvement even with appropriate interventions.

PRONOUN USAGE:
28. Use appropriate pronouns based on your gender in the scenario (he/him/his for male, she/her/hers for female)
29. When describing in third person narrative, use the patient's correct gender pronouns (he/him/his for male patients, she/her/hers for female patients)
30. Be consistent with your gender throughout the conversation

VITAL SIGNS RESPONSES:
31. When EMT requests specific vitals (HR/heart rate, BP/blood pressure, RR/respiratory rate, Temp/temperature, SpO2/oxygen saturation): 
   - First provide a natural patient acknowledgment (see ACKNOWLEDGMENT STYLE below)
   - Then provide ONLY the requested specific vitals
   - Example: "Check my heart rate" → "Okay, go ahead." [then provide HR only]
   - Example: "Get BP and temperature" → "Sure, that's fine." [then provide BP and Temp only]

32. When EMT requests "vitals" or "vital signs" generically (without specifying which):
   - Ask "Which vitals would you like me to check?"
   - Do NOT provide any vitals until they specify

33. When EMT mentions pulse oximeter, oxygen saturation, or finger probe:
   - Respond naturally as the patient would to having a device placed on their finger
   - The system will automatically provide SpO2 readings - acknowledge the reading naturally

34. When EMT mentions transport decision or code: Acknowledge the transport choice appropriately

ACKNOWLEDGMENT STYLE:
35. Generate appropriate patient acknowledgments based on scenario type and difficulty:
   - Respiratory scenarios: Short, breathless phrases ("Okay... go ahead", "Sure... do it")
   - Cardiac scenarios: Anxious, hurried phrases ("Okay, please hurry", "Alright, that's fine")  
   - Trauma scenarios: Cautious, protective phrases ("Okay, but please be careful", "Alright, please be gentle")
   - Neurologic scenarios: Confused, uncertain phrases ("Um... okay, I think", "Okay... that's fine")
   - Metabolic scenarios: Cooperative phrases ("Sure, that's fine", "Okay, go ahead")
   - General scenarios: Simple phrases ("Okay", "Alright", "Sure")

36. Difficulty-based acknowledgment tone:
   - NOVICE: Cooperative and warm ("Okay, thank you", "Sure, that's fine")
   - INTERMEDIATE: Neutral and standard ("Okay", "Alright")
   - ADVANCED: Anxious or short ("Okay... please be quick", "Okay...")

37. Always put acknowledgments in quotation marks and end with appropriate punctuation

INTERVENTION RESPONSES:
38. When EMT gives oxygen therapy (nasal cannula, mask, BVM): Show improvement in breathing and SpO2, feel more comfortable
39. When EMT gives aspirin for chest pain: Show gradual improvement in chest pain and anxiety
40. When EMT gives albuterol/nebulizer: Show improvement in breathing, may have slight increased heart rate as side effect
41. When EMT positions you upright: Show improvement in breathing and comfort
42. When EMT gives IV fluids: Show improvement in overall condition and energy
43. When EMT gives epinephrine: Show rapid improvement in severe symptoms
44. Show deterioration if critical interventions are delayed or missed
45. Respond to intervention quality - better technique = better results

RESPONSE GUIDELINES:
46. If asked about symptoms, describe them as the patient would
47. If asked about medical history, respond as the patient would
48. If asked about medications, respond as the patient would
49. If asked about allergies, respond as the patient would
50. For physical exams: React appropriately to being touched, examined, or having equipment used
51. Cooperate with medical procedures unless your condition prevents it

CONVERSATION AND INTRODUCTION HANDLING:
52. When EMT introduces themselves: Respond naturally as the patient would, acknowledging their presence
53. When EMT says "Hi" or greets you: Respond with appropriate patient greeting based on your condition
54. When EMT asks "what's the problem": Describe your chief complaint and current symptoms
55. NEVER ask for clarification on introductions, greetings, or basic conversation
56. Always respond in character as the patient, even for simple interactions
57. Example responses to "Hi I'm John, I'm an EMT":
    - Alert patient: "Oh thank goodness you're here! I'm really worried about..."
    - Anxious patient: "Please help me, I don't know what's happening..."
    - Confused patient: "Who... who are you? I'm so confused..."

SCENARIO EVOLUTION:
58. Show natural progression of your condition based on time and interventions
59. If critical interventions are delayed: Show gradual deterioration (increased symptoms, decreased cooperation)
60. If appropriate interventions are given: Show improvement (decreased symptoms, increased cooperation)
61. If inappropriate interventions are given: Show no improvement or slight worsening
62. Show complications if critical interventions are missed (e.g., cardiac arrest if aspirin delayed for chest pain)
63. Respond to intervention quality - better technique = better results
64. Show realistic time-based changes (condition may worsen if untreated for too long)
65. Maintain consistency with your initial presentation and medical condition

VITAL SIGNS GENERATION:
66. Generate realistic vital signs based on your medical condition and scenario type
67. Cardiac conditions: Show elevated heart rate, blood pressure changes, normal to slightly low SpO2
68. Respiratory conditions: Show elevated respiratory rate, decreased SpO2, normal heart rate
69. Trauma conditions: Show elevated heart rate, normal to elevated blood pressure, normal SpO2
70. Neurologic conditions: Show normal vital signs unless severe, may have altered mental status
71. Metabolic conditions: Show variable vital signs based on specific condition
72. Show vital sign changes based on interventions (oxygen improves SpO2, aspirin may lower heart rate)
73. Maintain realistic ranges: HR 40-200, RR 8-50, BP 60/40-250/150, SpO2 70-100%, Temp 95-106°F
74. Show gradual improvement or deterioration based on intervention quality and timing

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
    
    console.log('🔍 Checking if patient conversation:', { message });
    
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
      /\bwhat\s+is\s+your\s+name/,
      /\bcan\s+you\s+tell\s+me\s+your\s+name/,
      /\byour\s+name(?:\s+(?:sir|ma'am|please))?/,
      /\bwhat\s+is\s+your\s+name\s+sir/,
      /\bwhat\s+is\s+your\s+name\s+ma'am/
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
      // Orientation questions (neuro checks)
      /\b(do\s+you\s+remember|do\s+you\s+know)\s+where\s+you\s+are\b/,
      /\bwhere\s+are\s+you\s+(now|right\s+now)?\b/,
      /\bwhat\s+city\b|\bwhat\s+state\b|\bwhat\s+year\b|\bwhat\s+day\b|\bwhat\s+is\s+today'?s\s+date\b/,
      /\bwho\s+is\s+(the\s+)?president\b/,
      // Time orientation
      /\b(do\s+you\s+remember|do\s+you\s+know)\s+(what\s+)?time(\s+of\s+day)?\b/,
      /\bwhat\s+time(\s+of\s+day)?\b/,
      /\bwhat\s+month\b/,
      /\bwhat\s+day\s+of\s+the\s+week\b/,
      // Direct reassurance and conversational phrases
      /\bwe'?ll\s+get\s+(?:that|this|you)\s+sorted/,
      /\bwe'?re\s+(?:here\s+to\s+help|going\s+to\s+take\s+care)/,
      /\blet'?s\s+get\s+you\s+(?:sorted|fixed\s+up|taken\s+care\s+of)/,
      /\bdon'?t\s+worry/,
      /\bwe'?re\s+going\s+to\s+help/,
      /\bcan\s+i\s+help\s+you\b/,
      /\bcan\s+i\s+assist\s+you\b/,
      // Direct patient requests (asking patient to do something)
      /\bcan\s+you\s+(?:open|close|lift|raise|lower|move|turn|show|squeeze)/,
      /\bplease\s+(?:open|close|lift|raise|lower|move|turn|show|squeeze)/,
      /\b(?:open|close|lift|raise|squeeze)\s+your\s+(?:mouth|eyes|hand|arm|leg)/,
      // Offering assistance/comfort items
      /\bwould\s+you\s+like\s+(?:a|some|an)/,
      /\bdo\s+you\s+want\s+(?:a|some|an)/,
      /\bdo\s+you\s+need\s+(?:a|some|an)/,
      /\bcan\s+i\s+get\s+you\s+(?:a|some|an)/,
      // Intent/future statements (announcing what you're about to do)
      /\bi'?m\s+(?:going\s+to|gonna)\s+/,
      /\bi\s+will\s+/,
      /\bi'?ll\s+/,
      /\blet\s+me\s+/,
      // History-taking phrases (OPQRST-style)
      /\bwhen\s+did\s+(?:it|this|that)\s+(?:start|begin)\b/,
      /\bwhen\s+did\s+(?:your|the)\s+[a-z\s]+\s+(?:start|begin)\b/,
      /\bhow\s+long\s+(?:have\s+you\s+had|has\s+this\s+been\s+going\s+on)\b/,
      /\bwhat\s+makes\s+(?:it|this|that)\s+(?:better|worse)\b/,
      /\bdoes\s+anything\s+make\s+(?:it|this|that)\s+(?:better|worse)\b/,
      /\bwhat\s+were\s+you\s+doing\s+when\b/
    ];
    
    // Check if it matches conversation patterns
    const isConversation = [...introPatterns, ...conversationPatterns].some(pattern => 
      pattern.test(message)
    );
    
    console.log('🔍 Pattern match result:', { isConversation });
    
    // Check for action words that indicate medical assessment/intervention
    // These indicate the message contains an actionable medical task
    const actionWordPatterns = [
      /\bcheck\s+(?:vitals|pulse|blood pressure|bp|breathing|temperature|airway|for)/,
      /\btake\s+(?:vitals|pulse|blood pressure|temperature|measurements)/,
      /\bget\s+(?:vitals|pulse|blood pressure|equipment|stretcher|iv|medication)/,
      /\bobtain\s+(?:vitals|history|iv)/,
      /\bmeasure\s+(?:vitals|pulse|blood pressure)/,
      /\blisten\s+(?:to\s+)?(?:lungs|heart|breathing|chest)/,
      /\bfeel\s+(?:pulse|for)/,
      /\bpalpate\b/,
      /\bassess\s+(?:airway|breathing|circulation)/,
      /\bcheck\s+(?:the\s+)?airway\b/,
      /\binspect\s+(?:the\s+)?airway\b/,
      /\bopen\s+(?:your|the)\s+mouth.*(?:check|airway|look)/,
      /\bvitals\b/, /\bpulse\b/, /\bblood pressure\b/, /\bbp\b/, /\bheart rate\b/, /\bhr\b/, /\btemperature\b/,
      /\boxygen\b/, /\bo2\b/, /\bspo2\b/, /\brespiratory rate\b/, /\brr\b/,
      /\biv\b/, /\bmedication\b/, /\bdrug\b/,
      /\bgive\s+(?:medication|drug|iv|oxygen)/,
      /\badminister\b/, /\binject\b/,
      /\btransport\s+(?:to|patient)/, /\bmove\s+(?:patient)/, /\blift\s+(?:patient)/, /\bposition\s+(?:patient)/, /\bimmobilize\b/
    ];
    
    let hasActionWords = actionWordPatterns.some(pattern => pattern.test(message));
    
    // Check for intent/future tense statements - these should NOT trigger actions
    // e.g., "I'm gonna place a pulse oximeter" vs "I placed a pulse oximeter"
    const intentPatterns = [
      /\bi'?m\s+(?:going\s+to|gonna)\s+/,
      /\bi\s+will\s+/,
      /\bi'?ll\s+/,
      /\blet\s+me\s+/,
      /\bi\s+want\s+to\s+/,
      /\bi'?d\s+like\s+to\s+/,
      /\bcan\s+i\s+/,
      /\bmay\s+i\s+/
    ];
    
    const isIntent = intentPatterns.some(pattern => pattern.test(message));
    
    // If it's an intent statement, treat it as conversation only (no action performed yet)
    if (isIntent) {
      hasActionWords = false;
    }
    
    console.log('🔍 Action words check:', { hasActionWords, isIntent, message });
    
    // Return an object with both conversation and action indicators
    // This allows handling of hybrid messages (e.g., "Linda, can you open your mouth? I want to check your airway")
    const result = {
      isConversation: isConversation,
      hasActionWords: hasActionWords,
      isPureConversation: isConversation && !hasActionWords,
      isIntent: isIntent
    };
    console.log('🔍 Final conversation result:', { result });
    
    return result;
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
      // Prefer dispatch demographics to keep consistency if any mismatch occurs
      const age = patientProfile?.age || dispatchInfo?.age || 'unknown age';
      const gender = patientProfile?.gender || dispatchInfo?.gender || 'unknown gender';
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
- End with "\n\nAwaiting your next step."
- Maximum 3 sentences total for the description (plus the "Awaiting your next step." line)`;

      const userPrompt = `Create an initial scene description with these details:
- Location: ${location}
- Patient: ${age}-year-old ${gender}
- Appearance: ${appearance}
- Consciousness: ${consciousness}
- Breathing: ${breathing}
- Skin: ${skin}

Do NOT mention specific symptoms or complaints. Only describe what is visually observable.`;

      // Call OpenAI to generate the scene description
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
      
      // Use higher-quality model for scene generation
      const response = await this.callOpenAI(messages, { model: 'gpt-4o' });
      
      // Ensure the response ends with "Awaiting your next step." on a new line
      let impression = response;
      if (impression.endsWith('Awaiting your next step.')) {
        // Remove the existing "Awaiting your next step." and add it with proper formatting
        impression = impression.replace(/\s*Awaiting your next step\.\s*$/, '');
        impression += '\n\nAwaiting your next step.';
      } else if (!impression.endsWith('Awaiting your next step.')) {
        impression += '\n\nAwaiting your next step.';
      }
      
      return impression;
    } catch (error) {
      console.error('❌ Error building scene impression:', error);
      // Fall back to a simple template if AI generation fails
      return `You arrive on scene and encounter a patient.\n\nAwaiting your next step.`;
    }
  }

  // Format comprehensive feedback message for scenario ending
  formatFeedbackMessage(feedbackReport, endingCheck) {
    const { summary, checkboxItems, scoredSections, recommendations, strengths, areasForImprovement } = feedbackReport;
    
    let message = '';
    
    // Overall Results
    message += `**Overall Result: ${summary.pass ? '✅ PASS' : '❌ FAIL'}**\n`;
    message += `**Total Score: ${summary.totalScore}/${summary.maxScore} (${summary.percentage}%)**\n`;
    message += `**Time: ${summary.timeSpent}/${summary.timeLimit} minutes**\n\n`;
    
    // Pass Requirements Status
    message += '**Pass Requirements:**\n';
    message += `- All Critical Items: ${checkboxItems.completed === checkboxItems.total ? '✅' : '❌'} (${checkboxItems.completed}/${checkboxItems.total})\n`;
    message += `- All Sections ≥2: ${Object.values(scoredSections).every(s => s.score >= 2) ? '✅' : '❌'}\n`;
    message += `- Time Management: ${summary.timeSpent <= summary.timeLimit ? '✅' : '❌'}\n\n`;
    
    // Scored Sections Summary
    message += '**Section Scores:**\n';
    Object.entries(scoredSections).forEach(([key, section]) => {
      const emoji = section.score >= 2 ? '✅' : '❌';
      message += `${emoji} **${section.name}**: ${section.score}/3\n`;
    });
    message += '\n';
    
    // Critical Items Status
    if (checkboxItems.completed < checkboxItems.total) {
      message += '**❌ Missing Critical Items:**\n';
      Object.entries(checkboxItems.details).forEach(([key, item]) => {
        if (!item.completed) {
          message += `- ${item.description}\n`;
        }
      });
      message += '\n';
    }
    
    // Strengths
    if (strengths.length > 0) {
      message += '**💪 Strengths:**\n';
      strengths.forEach(strength => {
        message += `- ${strength}\n`;
      });
      message += '\n';
    }
    
    // Areas for Improvement
    if (areasForImprovement.length > 0) {
      message += '**📈 Areas for Improvement:**\n';
      areasForImprovement.forEach(area => {
        message += `- ${area}\n`;
      });
      message += '\n';
    }
    
    // Recommendations
    if (recommendations.length > 0) {
      message += '**💡 Recommendations:**\n';
      recommendations.forEach(rec => {
        message += `- ${rec}\n`;
      });
      message += '\n';
    }
    
    // Handover Analysis (if applicable)
    if (endingCheck.reason === 'handover') {
      const handoverContent = this.scenarioEndingManager.extractHandoverContent(endingCheck.userMessage || '');
      if (handoverContent) {
        const handoverAnalysis = this.scenarioEndingManager.analyzeHandoverQuality(handoverContent);
        const handoverFeedback = this.scenarioEndingManager.generateHandoverFeedback(handoverAnalysis, handoverContent);
        
        message += '**📋 Handover Report Analysis:**\n';
        handoverFeedback.forEach(feedback => {
          message += `- ${feedback}\n`;
        });
        message += '\n';
      }
    }
    
    // Ending note
    message += `*Scenario ended due to: ${this.getEndingReasonText(endingCheck.reason)}*`;
    
    return message;
  }
  
  // Helper method to format ending reason
  getEndingReasonText(reason) {
    switch (reason) {
      case 'handover':
        return 'Handover report provided';
      case 'manual':
        return 'Manual scenario termination';
      case 'timeout':
        return '20-minute time limit reached';
      default:
        return 'Unknown reason';
    }
  }

  // Handle new exam assessment request
  async handleExamAssessment(userMessage, conversation, scenarioData, examIntent) {
    const sessionId = this.generateSessionId(conversation);
    
    // Start new assessment
    const assessment = this.examAssessmentManager.startExamAssessment(sessionId, examIntent, scenarioData);
    
    if (!assessment) {
      return {
        response: 'I apologize, but I cannot start that type of examination assessment right now. Please try again.',
        additionalMessages: [],
        enhancedScenarioData: scenarioData
      };
    }

    // Generate acknowledgment and first question
    const acknowledgment = this.examAssessmentManager.generateAcknowledgmentMessage(examIntent);
    const firstQuestion = this.examAssessmentManager.getCurrentQuestion(sessionId);
    
    const response = `${acknowledgment}\n\n**Question ${firstQuestion.questionNumber} of ${firstQuestion.totalQuestions}:**\n${firstQuestion.questionText}\n\nAwaiting your next step.`;
    
    return {
      response,
      additionalMessages: [{ role: 'system', content: 'examAssessmentActive' }],
      enhancedScenarioData: scenarioData
    };
  }

  // Handle exam assessment answer submission
  async handleExamAssessmentAnswer(userMessage, conversation, scenarioData, sessionId) {
    const result = this.examAssessmentManager.submitAnswer(sessionId, userMessage);
    
    if (!result) {
      return {
        response: 'I apologize, but there was an issue processing your answer. Please try again.',
        additionalMessages: [],
        enhancedScenarioData: scenarioData
      };
    }

    if (result.status === 'continue') {
      // More questions to ask
      const nextQuestion = result.nextQuestion;
      const response = `**Question ${nextQuestion.questionNumber} of ${nextQuestion.totalQuestions}:**\n${nextQuestion.questionText}\n\nAwaiting your next step.`;
      
      return {
        response,
        additionalMessages: [],
        enhancedScenarioData: scenarioData
      };
    } else if (result.status === 'complete') {
      // Assessment complete, generate findings
      console.log('✅ Exam assessment completed, generating findings');
      
      // Generate comprehensive findings for the exam type
      const findings = await this.generateExamFindings(result.examKey, scenarioData);
      const completionMessage = `Assessment complete! Based on your ${result.examType.toLowerCase()}, here are your examination findings:\n\n${findings}\n\nAwaiting your next step.`;
      
      return {
        response: completionMessage,
        additionalMessages: [{ role: 'system', content: 'examAssessmentComplete' }],
        enhancedScenarioData: scenarioData
      };
    }

    // Fallback
    return {
      response: 'Assessment completed. Continuing with scenario.',
      additionalMessages: [],
      enhancedScenarioData: scenarioData
    };
  }

  // Generate comprehensive exam findings based on scenario
  async generateExamFindings(examKey, scenarioData) {
    try {
      // Create context for AI to generate realistic findings
      const examTypeInstructions = {
        focusedChest: 'Generate findings for a focused chest examination including inspection, palpation, and auscultation.',
        focusedAbdomen: 'Generate findings for a focused abdominal examination including inspection, auscultation, and palpation in proper sequence.',
        rapidTrauma: 'Generate findings for a rapid trauma assessment covering head, neck, chest, abdomen, pelvis, and extremities.',
        fullSecondary: 'Generate findings for a complete secondary assessment including detailed head-to-toe examination.'
      };

      const instruction = examTypeInstructions[examKey] || examTypeInstructions.focusedChest;
      
      const systemPrompt = `You are an EMT instructor providing realistic examination findings. Generate comprehensive, scenario-appropriate findings for the requested examination. Be specific and use proper medical terminology while keeping findings at EMT level. Include both normal and any relevant abnormal findings based on the patient's condition.`;
      
      const userPrompt = `${instruction}\n\nPatient scenario: ${scenarioData?.generatedScenario?.presentation?.chiefComplaint || 'chest pain patient'}\nAge: ${scenarioData?.generatedScenario?.patientProfile?.age || 'unknown'}\nGender: ${scenarioData?.generatedScenario?.patientProfile?.gender || 'unknown'}`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const response = await this.callOpenAI(messages, { model: 'gpt-4o-mini' });
      
      return response;
    } catch (error) {
      console.error('Error generating exam findings:', error);
      return 'Examination completed. Normal findings noted throughout the assessed areas.';
    }
  }

  // Generate a simple session ID based on conversation length
  generateSessionId(conversation) {
    // Simple session ID based on conversation hash - in production, use proper session management
    return `session_${conversation.length}_${Date.now()}`;
  }

  // Detect equipment placement that should provide automatic readings
  detectEquipmentPlacement(userMessage) {
    const normalized = TextNormalizer.normalizeToAsciiLower(userMessage);
    
    // Pulse oximeter placement patterns
    const pulseOxPatterns = [
      /place\s+(?:a\s+)?(?:pulse\s+)?(?:ox|oximeter)/,
      /put\s+(?:a\s+)?(?:pulse\s+)?(?:ox|oximeter)\s+on/,
      /apply\s+(?:a\s+)?(?:pulse\s+)?(?:ox|oximeter)/,
      /attach\s+(?:a\s+)?(?:pulse\s+)?(?:ox|oximeter)/,
      /place\s+(?:this|the)\s+(?:pulse\s+)?(?:ox|oximeter)/,
      /put\s+(?:this|the)\s+(?:pulse\s+)?(?:ox|oximeter)/
    ];
    
    // Blood pressure cuff patterns
    const bpCuffPatterns = [
      /place\s+(?:a\s+)?(?:bp\s+)?(?:cuff|blood pressure cuff)/,
      /put\s+(?:a\s+)?(?:bp\s+)?(?:cuff|blood pressure cuff)\s+on/,
      /apply\s+(?:a\s+)?(?:bp\s+)?(?:cuff|blood pressure cuff)/,
      /wrap\s+(?:a\s+)?(?:bp\s+)?(?:cuff|blood pressure cuff)/
    ];
    
    // Cardiac monitor patterns
    const monitorPatterns = [
      /place\s+(?:a\s+)?(?:cardiac\s+)?monitor/,
      /attach\s+(?:a\s+)?(?:cardiac\s+)?monitor/,
      /connect\s+(?:a\s+)?(?:cardiac\s+)?monitor/,
      /hook up\s+(?:a\s+)?(?:cardiac\s+)?monitor/
    ];

    // Check for pulse oximeter
    if (pulseOxPatterns.some(pattern => pattern.test(normalized))) {
      return {
        detected: true,
        equipmentType: 'pulse_oximeter',
        providesReading: true,
        readingType: 'oxygen saturation'
      };
    }

    // Check for blood pressure cuff
    if (bpCuffPatterns.some(pattern => pattern.test(normalized))) {
      return {
        detected: true,
        equipmentType: 'bp_cuff',
        providesReading: true,
        readingType: 'blood pressure'
      };
    }

    // Check for cardiac monitor
    if (monitorPatterns.some(pattern => pattern.test(normalized))) {
      return {
        detected: true,
        equipmentType: 'cardiac_monitor',
        providesReading: true,
        readingType: 'heart rate'
      };
    }

    // Other equipment that doesn't provide immediate readings
    const nonReadingEquipment = [
      /place\s+(?:a\s+)?(?:c-collar|cervical collar)/,
      /apply\s+(?:a\s+)?(?:c-collar|cervical collar)/,
      /place\s+(?:a\s+)?(?:nasal cannula|nc)/,
      /apply\s+(?:a\s+)?(?:nasal cannula|nc)/,
      /place\s+(?:a\s+)?(?:non-rebreather|nrb)/,
      /apply\s+(?:a\s+)?(?:non-rebreather|nrb)/
    ];

    if (nonReadingEquipment.some(pattern => pattern.test(normalized))) {
      return {
        detected: true,
        equipmentType: 'other',
        providesReading: false
      };
    }

    return { detected: false };
  }


}

module.exports = ChatService;