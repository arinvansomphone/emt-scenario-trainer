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
    
    // Intent classification cache (for hybrid conversation detection)
    this.intentCache = new Map();
    this.maxCacheSize = 100;
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

    // Detect pulse checks - includes checking hand/wrist and pulse quality mentions
    const wantsPulse = /(check|assess|feel|palpate|grab).*(radial|wrist|pulse|hand)/.test(t) ||
                       /(pulse).*(quality|rate|regular|strong)/.test(t);

    // Detect skin checks - checking skin condition, color, or CRT
    const wantsSkin = /(check|assess|look at|inspect|feel).*(skin)/.test(t) ||
                      /(cap(illary)?\s*refill|crt)/.test(t) ||
                      /(feel|check).*(hand).*(skin|quality)/.test(t);

    // Detect qualitative skin temperature without a thermometer
    // e.g. "check skin temperature", "feel their forehead", "check wrist for skin temperature"
    const wantsSkinTemp = !/(thermometer|temp(erature)?\s*reading|take.*temp)/.test(t) && (
      /(skin|forehead|wrist|hand|arm).*(temp(erature)?|warm|cool|hot|cold)/.test(t) ||
      /(temp(erature)?|warm|cool|hot|cold).*(skin|forehead|wrist|hand|arm)/.test(t) ||
      /feel.*(forehead|skin)/.test(t)
    );

    // Detect breathing quality checks (without RR request)
    // e.g. "quality of breathing", "how's her breathing", "assess breathing quality"
    const wantsBreathingQuality = /(quality\s+of\s+breathing|breathing\s+quality|how.*(breath|breathing)|assess.*breath|breath.*effort|work\s+of\s+breathing|breathing\s+effort)/.test(t) ||
      (/breath/.test(t) && /quality|effort|work|how|what/.test(t));

    const wantsAck = /(do\s+you\s+mind|is\s+it\s+(ok|okay|alright)|can\s+i|may\s+i|okay\s+if|ok\s+if|alright\s+if)/.test(t) || /\?\s*$/.test(t);
    return { wantsPulse, wantsSkin, wantsSkinTemp, wantsBreathingQuality, wantsAck, any: wantsPulse || wantsSkin || wantsSkinTemp || wantsBreathingQuality };
  }

  /**
   * Return a qualitative breathing description based on scenario type.
   */
  getBreathingQuality(scenarioData) {
    const subScenario = (scenarioData?.subScenario || '').toLowerCase();
    const symptoms = (scenarioData?.dispatchInfo?.symptoms || scenarioData?.generatedScenario?.presentation?.chiefComplaint || '').toLowerCase();

    if (/respiratory|asthma|breathing/.test(subScenario)) {
      if (/asthma/.test(symptoms) || /asthma/.test(subScenario)) {
        return 'labored with audible wheezing, accessory muscle use noted, speaking in short phrases';
      }
      return 'labored, increased work of breathing, accessory muscle use present';
    }
    if (/cardiac|chest pain|mi/.test(subScenario)) {
      return 'slightly labored, shallow, patient appears anxious';
    }
    if (/mvc|trauma|fall|assault|gsw|stabbing|burn/.test(subScenario)) {
      return 'guarded, shallow due to pain, splinting noted';
    }
    if (/neurolog|stroke|seizure/.test(subScenario)) {
      return 'irregular rate and depth, may be agonal or snoring depending on consciousness';
    }
    if (/metabolic|diabetic|hypoglycemi/.test(subScenario)) {
      return 'slightly rapid and deep (Kussmaul pattern), otherwise unlabored';
    }
    return 'unlabored, regular rate and depth, no accessory muscle use';
  }

  /**
   * Return a qualitative skin temperature description based on scenario type.
   * Used when EMT checks skin temp by touch (no thermometer).
   */
  getSkinTempQuality(scenarioData) {
    const subScenario = (scenarioData?.subScenario || '').toLowerCase();
    const symptoms = (scenarioData?.dispatchInfo?.symptoms || scenarioData?.generatedScenario?.presentation?.chiefComplaint || '').toLowerCase();

    if (/fever|febrile|sepsis/.test(symptoms) || /environmental/.test(subScenario)) return 'hot and diaphoretic';
    if (/cardiac|chest pain|mi/.test(subScenario) || /shock/.test(symptoms)) return 'cool and diaphoretic';
    if (/mvc|trauma|fall|assault|gsw|stabbing|burn/.test(subScenario)) return 'cool and slightly diaphoretic';
    if (/respiratory|asthma|breathing/.test(subScenario)) return 'warm and diaphoretic';
    if (/metabolic|diabetic|hypoglycemi/.test(subScenario) || /sweat/.test(symptoms)) return 'cool and clammy';
    if (/neurolog|stroke|seizure/.test(subScenario)) return 'warm and dry';
    return 'warm and dry';
  }

  formatPulseSkinResponse(pulseSkinReq, scenarioData) {
    const lines = [];
    if (pulseSkinReq.wantsAck) {
      lines.push(`"${this.generateSimpleAcknowledgment(scenarioData)}"`);
    }
    if (pulseSkinReq.wantsPulse) {
      try {
        const hrLine = this.patientSimulator.getSpecificVital('heart rate');
        lines.push('Radial pulse: regular and strong.');
        if (hrLine) lines.push(hrLine);
      } catch (_) {
        lines.push('Radial pulse: regular and strong.');
      }
    }

    if (pulseSkinReq.wantsSkinTemp) {
      const tempQuality = this.getSkinTempQuality(scenarioData);
      lines.push(`Skin temperature: ${tempQuality}.`);
    } else if (pulseSkinReq.wantsSkin) {
      const symptoms = (scenarioData?.dispatchInfo?.symptoms || scenarioData?.generatedScenario?.presentation?.chiefComplaint || '').toLowerCase();
      const hasFever = /fever|febrile|hot/.test(symptoms);
      const skinDesc = hasFever ? 'warm and slightly diaphoretic' : 'warm and dry';
      lines.push(`Skin: ${skinDesc}. Capillary refill brisk (<2 seconds).`);
    }

    if (pulseSkinReq.wantsBreathingQuality) {
      const breathQuality = this.getBreathingQuality(scenarioData);
      lines.push(`Breathing: ${breathQuality}.`);
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

  isHandoverReport(userText) {
    const normalized = TextNormalizer.normalizeToAsciiLower(userText || '');
    return /(handover|hand over|report|transport.*decision|my.*assessment|final.*report)/.test(normalized);
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
    if (!Array.isArray(conversation) || conversation.length === 0) return false;
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
    const difficultyLevel = scenarioData?.generatedScenario?.difficulty?.level || 'novice';
    
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
    
    // Safety check: ensure conversation is an array
    if (!Array.isArray(conversation)) {
      return adjustedVitals;
    }
    
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
  async forceEndScenario(userMessage, conversation, scenarioData) {
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
    
    // Generate comprehensive grading using EMED111 rubric (hybrid: keywords + AI)
    const gradingResults = await this.gradingEngine.gradeScenario(
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
    if (!Array.isArray(conversation)) {
      return '';
    }
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
    const difficultyLevel = scenarioData?.generatedScenario?.difficulty?.level || 'novice';
    
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

    // Auto-activate scenario if it exists but isn't marked active yet
    // (This handles cases where frontend starts a scenario but backend state wasn't updated)
    if (!this.currentScenarioActive && 
        scenarioData?.generatedScenario && 
        scenarioData?.meta?.startTime) {
      // Time limit disabled — always auto-activate regardless of elapsed time
      console.log('🔄 Auto-activating scenario (frontend started but backend was inactive)');
      this.currentScenarioActive = true;
      this.scenarioStartTime = scenarioData.meta.startTime;
      this.patientSimulator.initializePatient(scenarioData);
      this.bystanderManager.generateBystanders(scenarioData);
      this.environmentalManager.generateEnvironmentalFactors(scenarioData);
      this.performanceEvaluator.startEvaluation(scenarioData, this.scenarioStartTime);
    }

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
        
        // If template approach fails after retries, use fallback dispatch so user can still proceed
        console.log('⚠️ Template approach failed after retries, using fallback dispatch');
        const fallbackData = this.templateGenerator.generateFallbackDispatch(scenarioData.subScenario);
        scenarioData.dispatchInfo = fallbackData;
        const fallbackName = this.templateGenerator.generatePatientName(fallbackData.gender, fallbackData.age);
        scenarioData.generatedScenario = {
          dispatchInfo: fallbackData,
          patientProfile: {
            age: fallbackData.age,
            gender: fallbackData.gender,
            name: fallbackName,
            medicalHistory: ['Unknown'],
            medications: ['None known'],
            allergies: ['NKDA']
          },
          presentation: {
            chiefComplaint: fallbackData.symptoms || fallbackData.mechanism || 'medical emergency',
            onsetTime: 'recent',
            severity: 'moderate'
          }
        };
        if (scenarioData.meta) scenarioData.meta.timeLimitMinutes = this.scenarioEndingManager.TIME_LIMIT_MINUTES;
        else scenarioData.meta = { timeLimitMinutes: this.scenarioEndingManager.TIME_LIMIT_MINUTES };
        const dispatchContent = await PostProcessor.enforceInitialDispatchMessage('', scenarioData);
        return {
          response: dispatchContent,
          additionalMessages: [],
          enhancedScenarioData: scenarioData
        };
      } catch (error) {
        console.error('❌ Failed to generate comprehensive scenario:', error);
        return { 
          response: '**Sorry, we couldn\'t generate a scenario right now.** Please refresh the page and try again. If the problem persists, check that your OpenAI API key is valid.', 
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
        
        // Generate comprehensive grading using EMED111 rubric (hybrid: keywords + AI)
        const gradingResults = await this.gradingEngine.gradeScenario(
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
      // Airway/mouth check: intercept before conversation handler so patient opens
      // mouth and EMT receives an objective airway finding.
      const mouthCheckPattern = /\b(open|show me|look in|look at|check|inspect)\s+(your\s+)?(mouth|airway)\b|\bcan you open your mouth\b/i;
      if (mouthCheckPattern.test(userMessage)) {
        console.log('👄 Mouth/airway check detected');
        const airwayFinding = this.generateAirwayFinding(scenarioData);
        const prevConv = Array.isArray(conversation) ? conversation : [];
        const updatedConversation = [
          ...prevConv,
          { role: 'user', content: userMessage },
          { role: 'assistant', content: airwayFinding }
        ];
        return { response: airwayFinding, conversation: updatedConversation, additionalMessages: [], enhancedScenarioData: scenarioData };
      }

      // Pulse / skin / breathing quality quick response — runs before conversation
      // handler so qualitative assessment messages aren't misrouted as patient chat.
      const pulseSkinReqEarly = this.detectPulseSkinRequest(userMessage);
      if (pulseSkinReqEarly.any) {
        const findings = this.formatPulseSkinResponse(pulseSkinReqEarly, scenarioData);
        const response = `${findings}\n\nAwaiting your next step.`;
        const prevConversation = Array.isArray(conversation) ? conversation : [];
        const updatedConversation = [
          ...prevConversation,
          { role: 'user', content: userMessage },
          { role: 'assistant', content: response }
        ];
        return { response, conversation: updatedConversation, additionalMessages: [], enhancedScenarioData: scenarioData };
      }

      // Early conversation handling: if the user is introducing themselves or
      // engaging in simple conversation, force a patient reply BEFORE any
      // action recognition to avoid unnecessary clarification prompts.
      const earlyConversationCheck = await this.isPatientConversation(userMessage);
      if (earlyConversationCheck.isPureConversation) {
        console.log('💬 Handling introduction/conversation before action recognition');
        const additionalContext = 'PATIENT_CONVERSATION: The EMT is talking to you about their FUTURE plans, NOT performing an action right now. Respond naturally as the patient with just verbal acknowledgment. DO NOT describe any interventions being performed or any physical changes happening. Keep it short and in quotes. NO actions are being performed yet.';
        const messages = await this.createMessages(userMessage, conversation, scenarioData, null, additionalContext);
        const response = await this.callOpenAI(messages);
        let sanitized = PostProcessor.postProcessObjectiveContent(response, userMessage, scenarioData);
        
        // If this is an intent statement (future tense), strip out any narrative after the patient quote
        if (earlyConversationCheck.isIntent) {
          console.log('🔧 Intent detected - stripping narrative from response');
          sanitized = this.stripNarrativeFromIntent(sanitized);
        }
        
        const prevConversation = Array.isArray(conversation) ? conversation : [];
        const updatedConversation = [
          ...prevConversation,
          { role: 'user', content: userMessage },
          { role: 'assistant', content: sanitized }
        ];
        return { response: sanitized, conversation: updatedConversation, additionalMessages: [], enhancedScenarioData: scenarioData };
      }

      // Check for stroke / neurological assessment (FAST, Cincinnati, CPSS)
      const strokePattern = /\b(stroke\s+assessment|fast\s+assessment|fast\s+test|cincinnati|cpss|facial\s+droop|arm\s+drift|speech\s+test|neuro(logical)?\s+assessment|assess.*stroke|stroke.*scale)\b/i;
      if (strokePattern.test(userMessage)) {
        console.log('🧠 Stroke assessment detected');
        const findings = this.generateStrokeAssessmentFindings(scenarioData);
        const prevConv = Array.isArray(conversation) ? conversation : [];
        const updatedConversation = [
          ...prevConv,
          { role: 'user', content: userMessage },
          { role: 'assistant', content: findings }
        ];
        return { response: findings, conversation: updatedConversation, additionalMessages: [], enhancedScenarioData: scenarioData };
      }

      // Check for physical exam assessment intent
      const examIntent = this.examAssessmentManager.detectExamIntent(userMessage);
      if (examIntent.detected) {
        console.log('📋 Physical exam assessment detected:', examIntent);
        return await this.handleExamAssessment(userMessage, conversation, scenarioData, examIntent);
      }

      // Check for equipment placement FIRST (before action recognition processing)
      const equipmentPlacement = this.detectEquipmentPlacement(userMessage);
      if (equipmentPlacement.detected) {
        let response;
        
        // For pulse oximeter, only provide the reading without patient response
        // This avoids giving hints about the quality of the SpO2 value
        if (equipmentPlacement.equipmentType === 'pulse_oximeter') {
          if (equipmentPlacement.providesReading) {
            const reading = this.patientSimulator.getSpecificVital(equipmentPlacement.readingType);
            response = `${reading}\n\nAwaiting your next step.`;
          }
        } else {
          // For other equipment, include patient response
          const patientResponse = this.patientSimulator.generatePatientResponse(userMessage, scenarioData);
          response = patientResponse || '';
          
          // Automatically provide readings for monitoring equipment
          if (equipmentPlacement.providesReading) {
            const reading = this.patientSimulator.getSpecificVital(equipmentPlacement.readingType);
            response += `\n\n${reading}`;
          }
          
          response += '\n\nAwaiting your next step.';
        }
        
        return {
          response,
          additionalMessages: [],
          enhancedScenarioData: scenarioData
        };
      }

      const recognizedAction = this.actionRecognizer.recognizeAction(userMessage);
      
      // Log action for performance evaluation
      this.performanceEvaluator.logAction(userMessage, Date.now(), recognizedAction.details);
      
      // Record interventions in patient simulator
      if (recognizedAction.type === 'medicationAdmin' || recognizedAction.type === 'equipmentUse') {
        this.patientSimulator.recordIntervention(userMessage, Date.now());
      }
      
      // Handle scene safety actions (PPE, BSI precautions)
      if (recognizedAction.type === 'sceneSafety') {
        console.log('🦺 Scene safety action recognized:', recognizedAction.details);
        const ppeAck = this.generateSceneSafetyAcknowledgment(recognizedAction.details);
        return {
          response: `${ppeAck}\n\nAwaiting your next step.`,
          additionalMessages: [],
          enhancedScenarioData: scenarioData
        };
      }
      
      // Handle supportive care actions (emesis bag, blanket, water, etc.)
      if (recognizedAction.type === 'supportiveCare') {
        console.log('🤲 Supportive care action recognized:', recognizedAction.details);
        this.performanceEvaluator.logAction(userMessage, Date.now(), recognizedAction.details);
        const supportiveAck = await this.generateSupportiveCareAcknowledgment(recognizedAction.details, scenarioData);
        return {
          response: supportiveAck,
          additionalMessages: [],
          enhancedScenarioData: scenarioData
        };
      }
      
      // Handle oxygen administration actions
      if (recognizedAction.type === 'oxygenAdmin') {
        console.log('💨 Oxygen administration recognized:', recognizedAction.details);
        const oxygenAck = await this.generateOxygenAdminAcknowledgment(recognizedAction.details, scenarioData);
        // Record intervention for vitals update
        this.patientSimulator.recordIntervention(userMessage, Date.now());
        return {
          response: oxygenAck,
          additionalMessages: [],
          enhancedScenarioData: scenarioData
        };
      }
      
      // Handle OB delivery assistance
      if (recognizedAction.type === 'obDelivery') {
        console.log('👶 OB delivery action recognized:', recognizedAction.details);
        const deliveryResponse = this.generateOBDeliveryResponse(recognizedAction.details, scenarioData);
        return {
          response: `${deliveryResponse}\n\nAwaiting your next step.`,
          additionalMessages: [],
          enhancedScenarioData: scenarioData
        };
      }

      // Handle OB perineal exam (crowning check)
      if (recognizedAction.type === 'obExam') {
        console.log('🤰 OB perineal exam recognized');
        const obFinding = this.generateOBExamFinding(scenarioData);
        return {
          response: `${obFinding}\n\nAwaiting your next step.`,
          additionalMessages: [],
          enhancedScenarioData: scenarioData
        };
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
          vitalsRequest.isTemperature || vitalsRequest.isPulseOx || vitalsRequest.isBloodGlucose) {
        
        // Collect all requested vitals
        const requestedVitals = [];
        if (vitalsRequest.isHeartRate) requestedVitals.push('heart rate');
        if (vitalsRequest.isBloodPressure) requestedVitals.push('blood pressure');
        if (vitalsRequest.isRespRate) requestedVitals.push('respiratory rate');
        if (vitalsRequest.isTemperature) requestedVitals.push('temperature');
        if (vitalsRequest.isPulseOx) requestedVitals.push('oxygen saturation');
        if (vitalsRequest.isBloodGlucose) requestedVitals.push('blood glucose');
        
        // Get all requested vitals
        const vitalResponses = requestedVitals.map(vitalType => 
          this.patientSimulator.getSpecificVital(vitalType)
        );
        
        const patientResponse = this.patientSimulator.generatePatientResponse(userMessage, scenarioData);
        const patientLine = patientResponse ? `${patientResponse}\n\n` : '';

        return {
          response: `${patientLine}${vitalResponses.join('\n')}\n\nAwaiting your next step.`,
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

    // Guided physical exam flow removed

    // Handle active scenario interactions OR conversation during any scenario
    let additionalContext = null;
    const conversationCheckForScenario = await this.isPatientConversation(userMessage);
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
      const conversationCheck = await this.isPatientConversation(userMessage);
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
            actionContext = `CONTRAINDICATION ALERT: ${contraindication}`;
          }
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
      this.patientSimulator.updateVitalsForTimeProgression(scenarioData);
      this.patientSimulator.updateConsciousness(scenarioData);
      
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

    // Immediate region findings when user checks/assesses body parts
    const regionChecks = this.detectRegionChecks(userMessage);
    if (regionChecks.length > 0) {
      const findings = this.formatRegionFindings(regionChecks, scenarioData);
      const response = `${findings}\n\nAwaiting your next step.`;
      const prevConversation = Array.isArray(conversation) ? conversation : [];
      const updatedConversation = [
        ...prevConversation,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: response }
      ];
      return { response, conversation: updatedConversation, additionalMessages: [], enhancedScenarioData: scenarioData };
    }

    // Standard LLM response generation
    const messages = await this.createMessages(userMessage, conversation, scenarioData, null, additionalContext || null);
    const response = await this.callOpenAI(messages);

    // Post-process the response
    let sanitized = PostProcessor.postProcessObjectiveContent(response, userMessage, scenarioData);

    // Check if this is the first message in a scenario (no previous conversation).
    // Only enforce the initial dispatch if the scenario has NOT already been started —
    // otherwise an empty-conversation request (e.g. lost frontend state) would clobber
    // the real response with another dispatch.
    if ((!conversation || conversation.length === 0) && !this.currentScenarioActive) {
      sanitized = await PostProcessor.enforceInitialDispatchMessage(sanitized, scenarioData);
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

    // Build updated conversation array
    const prevConversation = Array.isArray(conversation) ? conversation : [];
    const updatedConversation = [
      ...prevConversation,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: finalResponse }
    ];

    return { 
      response: finalResponse,
      conversation: updatedConversation,
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
    
    // Add current vital signs for the LLM to use when responding to vitals requests
    if (scenarioData) {
      const vitalsContext = this.generateContextAwareVitals(conversation, scenarioData);
      systemMessage += `\n\nCURRENT VITAL SIGNS: ${vitalsContext}`;
    }
    
    // Add additional context LAST (if provided) so it has the most weight
    if (additionalContext) {
      console.log('🩺 System Message Debug - Adding context to system message (LAST for maximum weight)');
      systemMessage += `\n\n⚠️ CRITICAL INSTRUCTION FOR THIS RESPONSE: ${additionalContext}`;
    } else {
      console.log('🩺 System Message Debug - No additional context to add');
    }
    
    messages.push({ role: 'system', content: systemMessage });

    // Add conversation history (ensure it's an array)
    if (Array.isArray(conversation) && conversation.length > 0) {
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

CRITICAL - DO NOT IMPROVISE SYMPTOMS:
22. ONLY report symptoms, complaints, and conditions that are explicitly listed in the DETAILED PATIENT INFORMATION section below. Do NOT invent new symptoms, new injuries, new dizziness, new pain locations, new complaints, or any physical findings that are not already part of your scenario profile. If you are an alert patient, do NOT spontaneously describe confusion, dizziness, or altered mental status unless those are listed as your chief complaint or physical findings.

PATIENT BEHAVIOR BY CONSCIOUSNESS:
22. Alert: Respond clearly and promptly ("Absolutely", "Of course", attentive nods)
23. Confused: Respond uncertainly, ask questions ("I'm... confused", "What's happening?")
24. Unresponsive: No verbal responses, only describe physical observations

DIFFICULTY-BASED BEHAVIOR:
25. NOVICE (Training Mode): Be cooperative and helpful. Give clear, complete answers. Show appreciation for EMT care. Respond positively to interventions and feel better when treated appropriately. Be reassuring to build student confidence. Vital signs remain stable, symptoms are clear and consistent — you have ONE single condition with no secondary complaints or comorbidities. Show rapid improvement with any appropriate intervention.

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
38. CRITICAL: Only respond to interventions when they are ACTUALLY BEING PERFORMED (actions), NOT when they are mentioned as future plans
   - If EMT says "I'm gonna give you oxygen" or "I'm going to apply oxygen" or "I'll give you oxygen" → respond with ONLY a verbal acknowledgment in quotes, DO NOT add any narrative about the intervention being performed
   - WRONG: "Okay" + "As the oxygen is placed on her nose, she breathes easier"
   - CORRECT: "Okay, I understand"
   - If EMT says "I apply oxygen at 4 LPM" or "I place the nasal cannula on your nose" → NOW show the intervention effects with narrative
39. When EMT ACTUALLY gives oxygen therapy (nasal cannula, mask, BVM): Show improvement in breathing and SpO2, feel more comfortable
40. When EMT ACTUALLY gives aspirin for chest pain: Show gradual improvement in chest pain and anxiety
41. When EMT ACTUALLY gives albuterol/nebulizer: Show improvement in breathing, may have slight increased heart rate as side effect
42. When EMT ACTUALLY positions you upright: Show improvement in breathing and comfort
43. When EMT ACTUALLY gives IV fluids: Show improvement in overall condition and energy
44. When EMT ACTUALLY gives epinephrine: Show rapid improvement in severe symptoms
45. Show deterioration if critical interventions are delayed or missed
46. Respond to intervention quality - better technique = better results

RESPONSE GUIDELINES:
47. If asked about symptoms, describe them as the patient would
48. If asked about medical history, respond as the patient would
49. If asked about medications, respond as the patient would
50. If asked about allergies, respond as the patient would
51. For physical exams: React appropriately to being touched, examined, or having equipment used
52. Cooperate with medical procedures unless your condition prevents it

CONVERSATION AND INTRODUCTION HANDLING:
53. When EMT introduces themselves: Respond naturally as the patient would, acknowledging their presence
54. When EMT says "Hi" or greets you: Respond with appropriate patient greeting based on your condition
55. When EMT asks "what's the problem": Describe your chief complaint and current symptoms
56. NEVER ask for clarification on introductions, greetings, or basic conversation
57. Always respond in character as the patient, even for simple interactions
58. Example responses to "Hi I'm John, I'm an EMT":
    - Alert patient: "Oh thank goodness you're here! I'm really worried about..."
    - Anxious patient: "Please help me, I don't know what's happening..."
    - Confused patient: "Who... who are you? I'm so confused..."

SCENARIO EVOLUTION:
59. Show natural progression of your condition based on time and interventions
60. If critical interventions are delayed: Show gradual deterioration (increased symptoms, decreased cooperation)
61. If appropriate interventions are given: Show improvement (decreased symptoms, increased cooperation)
62. If inappropriate interventions are given: Show no improvement or slight worsening
63. Show complications if critical interventions are missed (e.g., cardiac arrest if aspirin delayed for chest pain)
64. Respond to intervention quality - better technique = better results
65. Show realistic time-based changes (condition may worsen if untreated for too long)
66. Maintain consistency with your initial presentation and medical condition

VITAL SIGNS GENERATION:
67. Generate realistic vital signs based on your medical condition and scenario type
68. Cardiac conditions: Show elevated heart rate, blood pressure changes, normal to slightly low SpO2
69. Respiratory conditions: Show elevated respiratory rate, decreased SpO2, normal heart rate
70. Trauma conditions: Show elevated heart rate, normal to elevated blood pressure, normal SpO2
71. Neurologic conditions: Show normal vital signs unless severe, may have altered mental status
72. Metabolic conditions: Show variable vital signs based on specific condition
73. Show vital sign changes based on interventions (oxygen improves SpO2, aspirin may lower heart rate)
74. Maintain realistic ranges: HR 40-200, RR 8-50, BP 60/40-250/150, SpO2 70-100%, Temp 95-106°F
75. Show gradual improvement or deterioration based on intervention quality and timing

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
        const pp = gs.patientProfile || {};
        const medicalHistoryStr = Array.isArray(pp.medicalHistory) ? pp.medicalHistory.join(', ') : (pp.medicalHistory ?? 'Unknown');
        const medicationsStr = Array.isArray(pp.medications) ? pp.medications.join(', ') : (pp.medications ?? 'None known');
        const allergiesStr = Array.isArray(pp.allergies) ? pp.allergies.join(', ') : (pp.allergies ?? 'NKDA');
        systemMessage += `

DETAILED PATIENT INFORMATION:
- Name: ${pp.name || 'Unknown'}
- Age: ${pp.age || 'Unknown'} years old
- Gender: ${pp.gender || 'Unknown'}
- Medical History: ${medicalHistoryStr}
- Current Medications: ${medicationsStr}
- Allergies: ${allergiesStr}
- Chief Complaint: ${gs.presentation?.chiefComplaint || 'Unknown'}
- Symptom Onset: ${gs.presentation?.onsetTime || 'Unknown'}
- Current Condition: ${gs.physicalFindings?.consciousness || 'Alert'}

You are this specific patient named ${pp.name || 'Unknown'}. When asked your name, give this name. Respond consistently with this medical profile and current condition.

CRITICAL - CONSISTENCY RULES (never violate these):
1. Your medications are EXACTLY: ${medicationsStr}. Never say anything different. If the EMT asks about medications — directly, as a follow-up, or to confirm — always give this same answer. Do NOT say "I don't take anything" if you have medications listed, and do NOT say you take medications if the list is "none".
2. Your medical history is EXACTLY: ${medicalHistoryStr}. Always give this same answer. Do NOT invent conditions or deny conditions that are listed.
3. Your allergies are EXACTLY: ${allergiesStr}. Always give this same answer.
4. NEVER contradict yourself across messages. If you said something in a prior message, stay consistent with it.
5. ALWAYS answer the EMT's follow-up questions in context. NEVER respond with "I'm not sure what you mean", "Can you clarify?", "I don't understand", or similar confusion phrases when the EMT is asking you to elaborate on something YOU just said. Examples:
   - If you said "my pain radiates to my shoulder" and the EMT asks "which shoulder?" → answer with a specific side (e.g. "my left shoulder")
   - If you said "I have some medical issues" and the EMT asks "like what?" → list your actual conditions
   - If you said "it hurts here" and the EMT asks "where exactly?" → describe the location specifically
   - If you said "for a while now" and the EMT asks "how long?" → give a specific duration
6. When you describe a symptom (pain location, sensation, timing), be specific the FIRST time when possible. If you weren't specific, commit to a specific answer when asked a follow-up — pick one and stay consistent.
7. Do NOT improvise or invent details about your medical history, medications, or allergies that are not in your profile above. But you CAN provide reasonable specifics for symptoms (which side, how long, what it feels like) — once you commit to a detail, stay consistent with it for the rest of the scenario.`;
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
      // Safety check for conversation
      const conversationText = Array.isArray(conversation)
        ? conversation.map(msg => `${msg.role}: ${msg.content}`).join('\n')
        : 'No conversation data';
      
      const feedbackPrompt = `Based on the following EMT scenario conversation, provide structured feedback and scoring:

Scenario: ${scenarioData?.mainScenario || 'Medical'} - ${scenarioData?.subScenario || 'General'}

Conversation:
${conversationText}

Please provide:
1. Overall assessment (1-10 scale)
2. Key strengths
3. Areas for improvement
4. Specific recommendations
5. Final score and justification

Format your response as valid JSON only, with exactly these keys: assessment (string), strengths (array of strings), improvements (array of strings), recommendations (array of strings), score (number 1-10), justification (string). Do not wrap the JSON in markdown code blocks or add any text outside the JSON.`;

      const messages = [
        { role: 'system', content: 'You are an expert EMT instructor. You must respond with valid JSON only, no markdown or explanation.' },
        { role: 'user', content: feedbackPrompt }
      ];

      const response = await this.callOpenAI(messages);
      const raw = (response && typeof response === 'string') ? response.trim() : '';

      // Strip markdown code blocks if present (e.g. ```json ... ```)
      let jsonStr = raw;
      const codeBlockMatch = raw.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      }

      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed && typeof parsed.assessment === 'string' && typeof parsed.score === 'number') {
          return {
            assessment: parsed.assessment,
            strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
            improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
            recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
            score: Math.min(10, Math.max(1, Number(parsed.score))) || 5,
            justification: typeof parsed.justification === 'string' ? parsed.justification : ''
          };
        }
      } catch (parseError) {
        console.warn('Feedback JSON parse failed:', parseError.message, 'Raw snippet:', jsonStr.slice(0, 200));
      }

      return {
        assessment: 'Unable to parse feedback',
        strengths: [],
        improvements: [],
        recommendations: [],
        score: 5,
        justification: 'Error parsing feedback response'
      };
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
   * Generate acknowledgment for scene safety actions
   * @param {Object} actionDetails - Scene safety action details
   * @returns {string} - Acknowledgment message
   */
  generateSceneSafetyAcknowledgment(actionDetails) {
    const { ppeItems, safetyAction } = actionDetails;
    
    // Generate acknowledgment based on what PPE was donned
    if (safetyAction === 'donning' && ppeItems && ppeItems.length > 0) {
      const items = ppeItems.map(item => {
        switch (item) {
          case 'gloves': return 'gloves';
          case 'mask': return 'mask';
          case 'gown': return 'gown';
          case 'eyeProtection': return 'eye protection';
          case 'ppe': return 'PPE';
          case 'general': return 'protective equipment';
          default: return item;
        }
      });
      
      if (items.length === 1) {
        return `${items[0].charAt(0).toUpperCase() + items[0].slice(1)} donned.`;
      } else if (items.length === 2) {
        return `${items[0].charAt(0).toUpperCase() + items[0].slice(1)} and ${items[1]} donned.`;
      } else {
        return 'PPE donned.';
      }
    }
    
    // Other scene safety acknowledgments
    if (safetyAction === 'assessment') {
      return 'Scene assessed for safety.';
    }
    
    if (safetyAction === 'confirmation') {
      return 'Scene safety confirmed.';
    }
    
    // Default acknowledgment
    return 'PPE in place.';
  }

  /**
   * Generate acknowledgment for supportive care actions
   * Provides both patient response and moderator confirmation
   * @param {Object} actionDetails - Supportive care action details
   * @param {Object} scenarioData - Current scenario data
   * @returns {Promise<string>} - Acknowledgment message with patient response
   */
  async generateSupportiveCareAcknowledgment(actionDetails, scenarioData) {
    const { careItem, careAction } = actionDetails;
    
    // Generate patient response based on their condition
    const patientResponse = await this.patientSimulator.generatePatientResponse(
      `You are being given ${careItem}`, 
      scenarioData
    );
    
    // Generate moderator confirmation
    const itemLabel = careItem.charAt(0).toUpperCase() + careItem.slice(1);
    let moderatorConfirmation = '';
    if (careAction === 'placing') {
      const onPatientItems = ['blanket', 'towel', 'pillow', 'ice pack', 'cold pack', 'cool pack'];
      if (onPatientItems.includes(careItem)) {
        moderatorConfirmation = `[Moderator] ${itemLabel} placed on patient.`;
      } else {
        moderatorConfirmation = `[Moderator] ${itemLabel} placed nearby.`;
      }
    } else {
      moderatorConfirmation = `[Moderator] ${itemLabel} provided to patient.`;
    }
    
    // Combine patient response and moderator confirmation
    const patientLine = patientResponse ? `${patientResponse}\n\n` : '';
    return `${patientLine}${moderatorConfirmation}\n\nAwaiting your next step.`;
  }

  async generateOxygenAdminAcknowledgment(actionDetails, scenarioData) {
    const { flowRate, deliveryMethod } = actionDetails;
    
    // Generate moderator confirmation with specific details (no patient response)
    const flowInfo = flowRate !== 'unspecified flow rate' ? ` at ${flowRate}` : '';
    const moderatorConfirmation = `Oxygen administered via ${deliveryMethod}${flowInfo}. Patient has accepted the treatment.`;
    
    // Return only moderator confirmation
    return `${moderatorConfirmation}\n\nAwaiting your next step.`;
  }

  generateOBDeliveryResponse(actionDetails, scenarioData) {
    const step = actionDetails.deliveryStep || 'general_delivery';
    const patientName = scenarioData?.generatedScenario?.patientProfile?.name || 'the patient';

    switch (step) {
      case 'active_labor_support':
      case 'general_delivery':
        return `You position yourself to assist with the delivery. ${patientName} is coached through her contractions. With each push, more of the baby's head becomes visible. You support the perineum and guide the head gently as it crowns. The baby's head delivers successfully. You check for a nuchal cord — none present. With the next contraction the shoulders deliver, followed by the body. A baby girl is delivered.`;

      case 'delivery':
        return `You support the baby's head as it delivers, guiding it downward gently to allow the anterior shoulder to emerge, then upward for the posterior shoulder. The baby is delivered and you receive her in both hands.`;

      case 'cord_management':
        return `You clamp the umbilical cord in two places approximately 8–10 cm from the baby's abdomen and cut between the clamps. The cord is severed successfully.`;

      case 'newborn_wrap':
        return `You wrap the newborn snugly in a clean blanket to preserve body heat. She is warm and secure.`;

      case 'newborn_handoff':
        return `You carefully pass the wrapped newborn to the mother. She holds her baby for the first time. Both mother and baby are stable.`;

      case 'newborn_cleaning':
        return `You gently wipe the fluid and secretions from the baby's mouth, nose, and face with a clean towel. The airway is clear of visible debris.`;

      case 'newborn_suction':
        return `You suction the newborn's mouth first, then the nose with a bulb syringe. A small amount of fluid is cleared. The airway appears patent.`;

      case 'newborn_care':
        return `You dry the newborn vigorously with a clean towel, stimulating her as you do so. She is wrapped to maintain warmth. She begins to cry — a strong, healthy cry.`;

      case 'newborn_assessment':
        return `Newborn assessment: She is crying vigorously. Skin color is pink centrally with slight acrocyanosis of the extremities. Muscle tone is good. Heart rate is greater than 100 beats per minute. Respiratory effort is strong. APGAR score is approximately 8 at one minute.`;

      default:
        return `You assist ${patientName} through the delivery. The procedure proceeds as expected.`;
    }
  }

  generateOBExamFinding(scenarioData) {
    const subScenario = (scenarioData?.subScenario || '').toLowerCase();
    const chiefComplaint = (scenarioData?.generatedScenario?.presentation?.chiefComplaint || '').toLowerCase();
    const isOB = /ob|gyn|obstetric|labor|deliver|pregnant|birth|contraction/.test(subScenario + ' ' + chiefComplaint);

    if (!isOB) {
      return 'Perineal area inspected. No crowning or abnormal findings noted. This does not appear to be an obstetric emergency.';
    }

    const onset = scenarioData?.generatedScenario?.presentation?.onsetTime || 'several minutes';
    const contractionFrequency = /advanced|severe/.test(scenarioData?.generatedScenario?.difficulty?.level || '')
      ? 'every 1 to 2 minutes'
      : 'every 3 to 5 minutes';

    const crowningSeverity = /advanced/.test(scenarioData?.generatedScenario?.difficulty?.level || '')
      ? 'The baby\'s head is crowning with significant presenting visible. Delivery is imminent. Prepare for field delivery.'
      : 'The baby\'s head is crowning. Delivery is imminent.';

    return `Perineal area exposed and inspected. ${crowningSeverity} Contractions are occurring ${contractionFrequency}. The patient is in active labor.`;
  }

  // ---------- HYBRID CONVERSATION DETECTION SYSTEM ----------
  
  /**
   * Check for obvious medical actions (high confidence)
   */
  hasObviousAction(message) {
    const normalized = message.toLowerCase().trim();
    
    // Strong action indicators - these are almost always medical actions
    const strongActionPatterns = [
      /\b(place|apply|attach|insert|start|administer|give)\s+(iv|intravenous|medication|drug|oxygen|nasal cannula|non-rebreather)/,
      /\b(check|take|get|obtain|measure)\s+(vitals|blood pressure|bp|heart rate|pulse|temperature|respiratory rate)/,
      /\bwhat\s+(is|are)\s+(her|his|their|the\s+patient'?s?)?\s*(heart rate|hr|blood pressure|bp|respiratory rate|rr|oxygen|spo2|sp02|temperature|temp|blood glucose|bgl|pulse|vitals)/,
      /\b(listen|auscultate)\s+(to\s+)?(lungs|heart|chest|breathing|breath sounds)/,
      /\bpalpate\s+(abdomen|chest|pulse|radial|carotid)/,
      /\b(start|initiate|establish)\s+(an\s+)?iv\b/,
      /\b(administer|give)\s+\d+\s*(mg|mcg|ml|units|liters)/,
      /\bimmobilize\s+(c-spine|cervical|spine|neck|extremity)/,
      /\b(apply|place)\s+(tourniquet|splint|dressing|bandage|collar)/,
      /\b(transport|move)\s+to\s+(hospital|ambulance|stretcher)/,
      /\brapid\s+(trauma\s+)?(physical|exam|assessment)/,
      /\b(perform|do|conduct|run)\s+(a\s+)?rapid\s+(trauma\s+)?(physical|exam|assessment)/,
      /\b(perform|do|conduct|run)\s+(a\s+)?(full\s+)?focused\s+(physical|exam|assessment)/,
      /\b(perform|do|conduct|run)\s+(a\s+)?(full\s+)?secondary\s+(physical|exam|assessment)/,
      /\b(perform|do|conduct|run)\s+(a\s+)?(full|complete|whole|entire)\s+(body\s+)?(physical|exam|assessment)/,
      /\b(perform|do|conduct|run)\s+(a\s+)?head[\s-]to[\s-]toe/,
      /\bhead[\s-]to[\s-]toe(\s+(physical|exam|assessment|survey))?\b/,
      /\b(physical|secondary)\s+(exam|assessment|survey)\b/,
      /\b(full|complete)\s+(body\s+)?(physical|exam|assessment)\b/,
    ];
    
    return strongActionPatterns.some(pattern => pattern.test(normalized));
  }
  
  /**
   * Check for obvious conversation (high confidence)
   */
  hasObviousConversation(message) {
    const normalized = message.toLowerCase().trim();
    
    // Strong conversation indicators - these are almost always patient interaction
    const strongConversationPatterns = [
      /^(hi|hello|hey)\b/,  // Greetings at start
      /\bmy name is\b/,  // Introduction
      /\bi'?m\s+\w+\s+(from|with)\s+(the\s+)?(ambulance|ems|paramedics?|emt)/,  // EMT introduction
      /\b(what|can you tell me)\s+(is\s+)?(your|the)\s+name\b/,  // Name questions
      /\b(how\s+old|what'?s\s+your\s+age)\b/,  // Age questions
      /\bwhat\s+(happened|seems\s+to\s+be\s+the\s+problem|brings\s+you|'?s\s+going\s+on)\b/,  // Chief complaint
      /\b(when|how\s+long)\s+did\s+(this|that|it)\s+start\b/,  // Onset questions
      /\b(do\s+you\s+have|have\s+you\s+had|any)\s+(medical\s+history|allergies|medications)\b/,  // History
      /\b(where|can\s+you\s+tell\s+me\s+where)\s+(are\s+you|you\s+are)\b/,  // Orientation (place)
      /\b(what|do\s+you\s+know)\s+(day|year|month|time|date)\b/,  // Orientation (time)
      /\bwe'?re\s+(here\s+to|going\s+to)\s+(help|take\s+care)/,  // Reassurance
      /\bdon'?t\s+worry\b/,  // Reassurance
      /\bon\s+a\s+scale\s+of\b/,  // Pain scale
      /\b(where|show\s+me\s+where)\s+(does\s+it\s+hurt|is\s+the\s+pain)\b/,  // Pain location
      /\b(can\s+you|please)\s+(open|close|lift|raise|squeeze|move|show)\s+(your|me|my)\b/,  // Patient requests (neuro checks, cooperation)
      /\b(open|squeeze|lift|raise)\s+(your|my)\s+(mouth|hand|eyes|arm|leg)\b/,  // Direct patient requests
      /\bwe('?re|\s+are)\s+(going\s+to|gonna|here\s+to|staying)\b/,  // "we're going to", "we are gonna stay"
      /\bwe\s+(see|found|noticed|can\s+see)\s+(the\s+)?(baby|head|crowning)/,  // OB findings communicated to patient
      /\bstay(ing)?\s+here\b/,  // "we're staying here"
      /\bprepare\s+(the\s+)?(area|for)\s+(delivery|birth)\b/,  // OB delivery prep announcement
      /\b(everything\s+is|you'?re\s+(going\s+to\s+be|doing))\s+(okay|fine|alright|great|well)\b/,  // Reassurance
      /^(like\s+what|such\s+as|for\s+example|can\s+you\s+elaborate|tell\s+me\s+more|go\s+on|please\s+continue|anything\s+else|what\s+else|what\s+kind|what\s+type|how\s+so|why'?s\s+that|really\?|and\?|oh\?)\??\.?$/,  // Short follow-up clarifications
      /^(what\s+do\s+you\s+mean|what\s+medications?|what\s+conditions?|what\s+allergies?|which\s+ones?|how\s+long\s+ago|when\s+did\s+that\s+happen|how\s+often)\b/,  // History follow-ups
      /\b(tell\s+me\s+more\s+about|can\s+you\s+describe|what\s+does\s+the\s+(pain|discomfort|problem)\s+feel\s+like)\b/,  // Elaboration requests
      /^(which|what|where|when|how|why|who)\s+\w+(\s+\w+){0,4}\??\.?$/,  // Any short interrogative follow-up (≤6 words)
      /^(can\s+you|could\s+you|would\s+you)\s+(be\s+more\s+specific|clarify|explain)\b/,  // Politely asking for clarification
    ];
    
    return strongConversationPatterns.some(pattern => pattern.test(normalized));
  }
  
  /**
   * Use AI to classify intent for ambiguous messages
   */
  async classifyIntentWithAI(userMessage) {
    // Check cache first
    const cacheKey = userMessage.toLowerCase().trim();
    if (this.intentCache.has(cacheKey)) {
      console.log('🔍 Using cached intent classification');
      return this.intentCache.get(cacheKey);
    }
    
    try {
      console.log('🤖 Using AI to classify intent (ambiguous case)');
      
      const systemPrompt = `You are a classifier for an EMT training system. Classify the user's message as either:
- "CONVERSATION" if it's speaking to the patient, asking questions, providing reassurance, or requesting information from the patient
- "ACTION" if it's performing a medical procedure, examination, or intervention

Respond with ONLY one word: either "CONVERSATION" or "ACTION".`;

      const userPrompt = `Classify this EMT message: "${userMessage}"`;
      
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
      
      const response = await this.callOpenAI(messages, { model: 'gpt-4o-mini' });
      const classification = response.trim().toUpperCase();
      
      const isConversation = classification === 'CONVERSATION';
      
      // Cache the result
      this.intentCache.set(cacheKey, isConversation);
      
      // Manage cache size
      if (this.intentCache.size > this.maxCacheSize) {
        const firstKey = this.intentCache.keys().next().value;
        this.intentCache.delete(firstKey);
      }
      
      console.log('🤖 AI classification:', classification);
      return isConversation;
      
    } catch (error) {
      console.error('❌ AI classification failed, defaulting to conversation:', error);
      // On error, default to conversation to avoid breaking the flow
      return true;
    }
  }

  /**
   * Detect if user message is patient conversation rather than medical action
   * Uses hybrid approach: simple heuristics first, AI fallback for ambiguous cases
   */
  async isPatientConversation(userMessage) {
    const message = userMessage.toLowerCase().trim();
    
    console.log('🔍 HYBRID: Checking if patient conversation:', { message });
    
    // STEP 1: Check for intent/future tense statements first
    // These should always be treated as conversation (no action performed yet)
    const intentPatterns = [
      /\bi'?m\s+(?:also\s+)?(?:going\s+to|gonna)\s+/,
      /\bwe'?re?\s+(?:also\s+)?(?:going\s+to|gonna)\s+/,
      /\bwe\s+(?:are\s+)?(?:also\s+)?(?:going\s+to|gonna)\s+/,
      /\bi\s+(?:also\s+)?will\s+/,
      /\bwe\s+(?:also\s+)?will\s+/,
      /\bi'?ll\s+(?:also\s+)?/,
      /\bwe'?ll\s+(?:also\s+)?/,
      /\blet\s+me\s+/,
      /\bi\s+(?:also\s+)?want\s+to\s+/,
      /\bi'?d\s+(?:also\s+)?like\s+to\s+/,
      /\bcan\s+i\s+/,
      /\bmay\s+i\s+/,
      /\bjust\s+(?:going\s+to|gonna|want\s+to|need\s+to)\s+/,
      /\bi\s+(?:also\s+)?need\s+to\s+/,
    ];
    
    const isIntent = intentPatterns.some(pattern => pattern.test(message));
    if (isIntent) {
      console.log('🔍 HYBRID: Intent statement detected - treating as conversation', { message });
      return {
        isConversation: true,
        hasActionWords: false,
        isPureConversation: true,
        isIntent: true
      };
    }
    
    // STEP 2: Check for obvious actions (high confidence)
    const hasObviousAction = this.hasObviousAction(message);
    if (hasObviousAction) {
      console.log('🔍 HYBRID: Obvious action detected - not conversation');
      return {
        isConversation: false,
        hasActionWords: true,
        isPureConversation: false,
        isIntent: false
      };
    }
    
    // STEP 3: Check for obvious conversation (high confidence)
    const hasObviousConv = this.hasObviousConversation(message);
    if (hasObviousConv) {
      console.log('🔍 HYBRID: Obvious conversation detected');
      return {
        isConversation: true,
        hasActionWords: false,
        isPureConversation: true,
        isIntent: false
      };
    }
    
    // STEP 4: Ambiguous case - use AI to classify
    console.log('🔍 HYBRID: Ambiguous message - using AI classifier');
    const isConversationAI = await this.classifyIntentWithAI(userMessage);
    
    return {
      isConversation: isConversationAI,
      hasActionWords: !isConversationAI,
      isPureConversation: isConversationAI,
      isIntent: false
    };
  }

  /**
   * Build only the scene description (general impression) when the user says they're ready
   * @param {Object} generatedScenario - The AI-generated scenario data
   * @returns {string} - Scene description only, no patient dialogue
   */
  /**
   * Generate an objective airway finding when EMT asks patient to open their mouth
   * Finding is scenario-aware: respiratory/trauma/unconscious patients may have obstructions.
   */
  generateAirwayFinding(scenarioData) {
    const subScenario = (scenarioData?.subScenario || '').toLowerCase();
    const gender = (scenarioData?.generatedScenario?.patientProfile?.gender || 'male').toLowerCase();
    const consciousness = (scenarioData?.generatedScenario?.physicalFindings?.consciousness || 'alert').toLowerCase();
    const pronoun = gender === 'female' ? 'Her' : 'His';

    const isAltered = /confus|unconscious|unresponsive|altered/.test(consciousness);
    const isTrauma = /mvc|fall|assault|sport|stabbing|gsw|burn|trauma/.test(subScenario);
    const isRespiratory = /respiratory|asthma|breathing/.test(subScenario);

    // Patients who cannot cooperate open their mouth passively via jaw-thrust/chin-lift
    const openVerb = isAltered ? 'You open the airway with a jaw thrust. The mouth falls open.' : 'The patient opens their mouth.';

    let finding;

    if (isAltered) {
      // Altered patients: higher risk of obstruction
      const findings = [
        `${openVerb} Airway is patent. No secretions, blood, or foreign bodies visible. Tongue in normal position.`,
        `${openVerb} Secretions pooling at the posterior pharynx. Airway at risk — suctioning indicated.`,
        `${openVerb} Airway is clear. Mild moisture visible on mucosa. No obstruction.`,
      ];
      finding = findings[Math.floor(Math.random() * findings.length)];
    } else if (isTrauma) {
      const findings = [
        `${openVerb} Airway is patent. No blood, broken teeth, or foreign bodies. Mucosa intact.`,
        `${openVerb} Traces of blood visible in the oral cavity. No active bleeding or obstruction. Monitor closely.`,
        `${openVerb} Airway is clear. No obstructions noted.`,
      ];
      finding = findings[Math.floor(Math.random() * findings.length)];
    } else if (isRespiratory) {
      const findings = [
        `${openVerb} Airway is patent. No obstruction. ${pronoun} lips show mild cyanosis.`,
        `${openVerb} Airway is clear. No foreign bodies or secretions. Mild accessory muscle use noted.`,
        `${openVerb} Airway patent, no obstruction.`,
      ];
      finding = findings[Math.floor(Math.random() * findings.length)];
    } else {
      // Standard medical — clear airway is most common
      const findings = [
        `${openVerb} Airway is patent. No obstruction, foreign bodies, or secretions visible.`,
        `${openVerb} Airway is clear and patent.`,
        `${openVerb} No obstructions. Mucosa pink and moist.`,
      ];
      finding = findings[Math.floor(Math.random() * findings.length)];
    }

    return `${finding}\n\nAwaiting your next step.`;
  }

  /**
   * Generate objective Cincinnati/FAST stroke assessment findings based on scenario type.
   * Reports: Facial droop, Arm drift, Speech, and time of symptom onset.
   */
  generateStrokeAssessmentFindings(scenarioData) {
    const subScenario = (scenarioData?.subScenario || '').toLowerCase();
    const symptoms = (scenarioData?.dispatchInfo?.symptoms || scenarioData?.generatedScenario?.presentation?.chiefComplaint || '').toLowerCase();
    const isNeuro = /neurolog|stroke|seizure/.test(subScenario) || /weakness|drooping|slurr|speech|numb|vision|headache|confusion|confus/.test(symptoms);

    if (isNeuro) {
      // Positive stroke findings — scenario involves neurological complaint
      return `Cincinnati Prehospital Stroke Scale (CPSS) assessment:

**Facial Droop:** Positive — right-sided facial droop present. Left side moves normally when patient smiles.
**Arm Drift:** Positive — right arm drifts downward within seconds when both arms are extended with eyes closed.
**Speech:** Abnormal — speech is slurred; patient uses incorrect words at times.

CPSS Result: 3 out of 3 positive — high suspicion for acute stroke.

Awaiting your next step.`;
    } else {
      // Negative stroke findings — non-neurological scenario
      return `Cincinnati Prehospital Stroke Scale (CPSS) assessment:

**Facial Droop:** Negative — both sides of face move equally when patient smiles.
**Arm Drift:** Negative — both arms remain in position when extended with eyes closed.
**Speech:** Normal — patient speaks clearly and uses correct words.

CPSS Result: 0 out of 3 positive — no acute stroke signs at this time.

Awaiting your next step.`;
    }
  }

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

  // Handle new exam assessment request — immediately return findings, no quizzing
  async handleExamAssessment(userMessage, conversation, scenarioData, examIntent) {
    const findings = await this.generateExamFindings(examIntent.examKey, scenarioData);
    const response = `${findings}\n\nAwaiting your next step.`;
    return {
      response,
      additionalMessages: [],
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
      
      const systemPrompt = `You are an EMT instructor providing realistic examination findings. Generate comprehensive, scenario-appropriate findings for the requested examination. Include both normal and any relevant abnormal findings based on the patient's condition. Do NOT include any summary section, closing summary, or "Assessment Summary" label. Just provide the findings directly.

CRITICAL - Language level: Write at the level of an EMT-Basic, NOT a paramedic or physician. Use plain, everyday language for findings. Avoid advanced medical terminology that is outside EMT-Basic scope. Examples of what NOT to use: periorbital ecchymosis (say "bruising around the eyes"), hemothorax (say "blood in the chest cavity"), pneumothorax (say "collapsed lung"), crepitus (say "a crackling feeling"), subcutaneous emphysema (say "air bubbles under the skin"), tachycardia (say "fast heart rate"), diaphoretic (say "sweating heavily"). Use the kind of words an EMT would say out loud to their partner.`;
      
      const gs = scenarioData?.generatedScenario || {};
      const profile = gs.patientProfile || {};
      const presentation = gs.presentation || {};
      const physical = gs.physicalFindings || {};
      const expected = gs.expectedFindings || {};
      const dispatch = gs.dispatchInfo || {};
      const vitals = gs.vitals || {};

      const userPrompt = `${instruction}

PATIENT DETAILS — use these to generate consistent findings:
- Name: ${profile.name || 'unknown'}, Age: ${profile.age || 'unknown'}, Gender: ${profile.gender || 'unknown'}
- Chief complaint: ${presentation.chiefComplaint || 'unknown'}
- Mechanism / dispatch info: ${dispatch.mechanism || 'unknown'}
- Severity: ${presentation.severity || 'unknown'}
- General appearance: ${physical.generalAppearance || 'unknown'}
- Consciousness: ${physical.consciousness || 'unknown'}
- Airway: ${physical.airway || 'unknown'}
- Breathing: ${physical.breathing || 'unknown'}
- Circulation: ${physical.circulation || 'unknown'}
- Skin: ${physical.skin || 'unknown'}
- What EMTs should observe (inspection): ${expected.inspection || 'unknown'}
- What EMTs should feel (palpation): ${expected.palpation || 'unknown'}
- What EMTs should hear (auscultation): ${expected.auscultation || 'unknown'}
- Vitals: HR ${vitals.heartRate || '?'}, BP ${vitals.bloodPressure || '?'}, RR ${vitals.respiratoryRate || '?'}, SpO2 ${vitals.spO2 || '?'}%

IMPORTANT: Every finding you generate MUST be consistent with the patient details above. Do not introduce injuries, pain, or abnormalities in body regions that are not relevant to this patient's condition.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      let response = await this.callOpenAI(messages, { model: 'gpt-4o-mini' });

      // Strip any trailing summary section the AI may add
      response = response.replace(/\n*\*?\*?Assessment Summary\*?\*?:[\s\S]*/i, '').trim();

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

  // Strip narrative text from intent/future-tense statements
  // Keep only the patient's quoted dialogue
  stripNarrativeFromIntent(response) {
    if (!response || typeof response !== 'string') return response;
    
    // Find the first quoted dialogue (patient speech)
    const quoteMatch = response.match(/"[^"]+"/);
    if (!quoteMatch) {
      // No quote found, return as is
      return response;
    }
    
    const patientQuote = quoteMatch[0];
    
    // Return just the quote plus "Awaiting your next step."
    return `${patientQuote}\n\nAwaiting your next step.`;
  }

  // Detect equipment placement that should provide automatic readings
  detectEquipmentPlacement(userMessage) {
    const normalized = TextNormalizer.normalizeToAsciiLower(userMessage);
    
    // Pulse oximeter placement patterns
    const pulseOxPatterns = [
      /place\s+(?:(?:a|an|the)\s+)?(?:pulse\s+)?(?:ox|oximeter)/,
      /put\s+(?:(?:a|an|the)\s+)?(?:pulse\s+)?(?:ox|oximeter)\s+on/,
      /apply\s+(?:(?:a|an|the)\s+)?(?:pulse\s+)?(?:ox|oximeter)/,
      /attach\s+(?:(?:a|an|the)\s+)?(?:pulse\s+)?(?:ox|oximeter)/
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