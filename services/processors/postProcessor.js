// services/processors/postProcessor.js
const TextNormalizer = require('../utils/textNormalizer');

// Santa Clara County locations for scenario-aware dispatch generation
const SANTA_CLARA_LOCATIONS = {
  residential: [
    '1425 El Camino Real',
    '2850 Stevens Creek Blvd',
    '3456 Homestead Road',
    '789 Saratoga Avenue',
    '1234 Winchester Blvd',
    '567 Meridian Avenue',
    '890 Bascom Avenue',
    '2345 Camden Avenue'
  ],
  business: [
    'Westfield Valley Fair Mall',
    'Santana Row Shopping Center',
    'Stanford Shopping Center',
    'Great Mall of the Bay Area',
    'San Jose City Hall',
    'Valley Medical Center',
    'Cisco Systems Campus',
    'Apple Park Visitor Center'
  ],
  public: [
    'Kelley Park',
    'Almaden Lake Park',
    'Central Park (Santa Clara)',
    'Guadalupe River Park',
    'Mitchell Park',
    'Raging Waters San Jose',
    'SAP Center at San Jose',
    'Levi\'s Stadium parking lot'
  ],
  trauma: [
    'Highway 101 construction zone',
    'I-280 near Page Mill Road',
    'Stevens Creek Trail',
    'Los Gatos Creek Trail',
    'Almaden Expressway overpass',
    'Santa Clara University athletic field',
    'San Jose State University gym',
    'Local construction site on Bascom Ave'
  ]
};

// Content filtering patterns
const INAPPROPRIATE_PATTERNS = [
  /\b(fuck|shit|damn|hell|bitch|ass|crap)\b/gi,
  /\b(kill|murder|suicide|death|die|dead)\b/gi,
  /\b(racist|sexist|homophobic|discriminatory)\b/gi,
  /\b(graphic|gruesome|horrific|disturbing)\b/gi
];

class PostProcessor {
  /**
   * Content filtering for inappropriate content
   * @param {string} text - Text to filter
   * @returns {boolean} - True if content is appropriate
   */
  static isContentAppropriate(text) {
    if (!text || typeof text !== 'string') return true;
    
    for (const pattern of INAPPROPRIATE_PATTERNS) {
      if (pattern.test(text)) {
        console.log('❌ Content filtering: Inappropriate content detected');
        return false;
      }
    }
    return true;
  }

  /**
   * Validate dispatch combination for realism
   * @param {number} age - Patient age
   * @param {string} gender - Patient gender
   * @param {string} location - Location
   * @param {string} condition - Medical condition
   * @returns {boolean} - True if combination is realistic
   */
  static isDispatchRealistic(age, gender, location, condition) {
    // Age-condition mismatches
    if (age < 25 && condition.toLowerCase().includes('dementia')) return false;
    if (age < 18 && location.toLowerCase().includes('construction')) return false;
    if (age < 16 && location.toLowerCase().includes('office')) return false;
    
    // Location-condition mismatches
    if (condition.toLowerCase().includes('drowning') && !location.toLowerCase().includes('pool') && !location.toLowerCase().includes('lake') && !location.toLowerCase().includes('water')) return false;
    
    return true;
  }

  /**
   * Generate scenario-aware location based on scenario type
   * @param {string} scenarioType - Type of scenario
   * @param {number} seed - Randomization seed
   * @returns {string} - Selected location
   */
  static generateScenarioAwareLocation(scenarioType, seed = 0) {
    const type = scenarioType?.toLowerCase() || '';
    let locationPool = SANTA_CLARA_LOCATIONS.residential; // default
    
    if (type.includes('trauma') || type.includes('accident') || type.includes('fall')) {
      locationPool = SANTA_CLARA_LOCATIONS.trauma;
    } else if (type.includes('cardiac') || type.includes('respiratory')) {
      locationPool = [...SANTA_CLARA_LOCATIONS.residential, ...SANTA_CLARA_LOCATIONS.business];
    } else if (type.includes('overdose') || type.includes('poisoning')) {
      locationPool = [...SANTA_CLARA_LOCATIONS.public, ...SANTA_CLARA_LOCATIONS.residential];
    }
    
    const index = Math.abs(seed) % locationPool.length;
    return locationPool[index];
  }

  /**
   * Generate bystander information based on location
   * @param {string} location - Location string
   * @param {number} seed - Randomization seed
   * @returns {string} - Bystander information or empty string
   */
  static generateBystanderInfo(location, seed = 0) {
    if (!location || typeof location !== 'string') {
      return '';
    }
    const loc = location.toLowerCase();
    const shouldHaveBystander = (Math.abs(seed) % 3) === 0; // 33% chance
    
    if (!shouldHaveBystander) return '';
    
    if (loc.includes('home') || loc.includes('residential') || loc.includes('avenue') || loc.includes('road') || loc.includes('blvd')) {
      return 'Family member on scene.';
    } else if (loc.includes('office') || loc.includes('campus') || loc.includes('systems') || loc.includes('hall')) {
      return 'Coworker present.';
    } else if (loc.includes('construction') || loc.includes('athletic') || loc.includes('gym')) {
      return 'Coworker on scene.';
    } else if (loc.includes('mall') || loc.includes('center') || loc.includes('park') || loc.includes('public')) {
      return 'Bystander present.';
    }
    
    return 'Bystander on scene.';
  }

  /**
   * Generate time in 12-hour format
   * @param {number} seed - Randomization seed
   * @returns {string} - Time in format like "2:30 PM"
   */
  static generateTime(seed = 0) {
    const times = [
      '8:15 AM', '9:30 AM', '10:45 AM', '11:20 AM', '12:15 PM',
      '1:30 PM', '2:45 PM', '3:20 PM', '4:35 PM', '5:50 PM',
      '6:25 PM', '7:40 PM', '8:15 PM', '9:30 PM', '10:45 PM'
    ];
    const index = Math.abs(seed) % times.length;
    return times[index];
  }

  /**
   * Detect if the user explicitly requests auscultation
   * @param {string} userMessage - User message
   * @returns {boolean} - True if auscultation requested
   */
  static userRequestedAuscultation(userMessage) {
    const t = TextNormalizer.normalizeToAsciiLower(userMessage || '');
    return /(auscultate|listen (to|for) (lung|chest|breath) sounds|stethoscope|lung sounds)/.test(t);
  }

  /**
   * Add quotation marks around patient dialogue
   * @param {string} text - Input text
   * @returns {string} - Text with quoted patient dialogue
   */
  static addPatientDialogueQuotes(text) {
    if (!text || typeof text !== 'string') return text;
    
    // Pattern to find patient dialogue (common patient speech patterns)
    const dialoguePatterns = [
      // Pattern: "I feel..." or "I'm..." at start of sentence
      /\b(I\s+(?:feel|am|was|have|had|can't|cannot|don't|didn't|think|believe|need|want|would|will|know|remember)[^.!?]*[.!?])/gi,
      // Pattern: "Yes", "No", "Okay", "Sure" etc. at start or after comma/period
      /(?:^|[.!?]\s+)((?:Yes|No|Yeah|Nah|Okay|Sure|Alright|Fine|Maybe|I guess|Of course|Absolutely|Please|Help|Stop|Wait)[^.!?]*[.!?])/gi,
      // Pattern: Questions from patient
      /(?:^|[.!?]\s+)((?:What|Where|When|Why|How|Who|Can you|Could you|Will you|Are you|Is this)[^.!?]*\?)/gi,
      // Pattern: Expressions of pain/discomfort
      /(?:^|[.!?]\s+)((?:It hurts|That hurts|Ow|Ouch|Please be careful|Be gentle|That's painful)[^.!?]*[.!?])/gi
    ];
    
    let processedText = text;
    
    dialoguePatterns.forEach(pattern => {
      processedText = processedText.replace(pattern, (match, dialogue, offset) => {
        // Check if already in quotes
        if (dialogue.startsWith('"') && dialogue.endsWith('"')) {
          return match; // Already quoted
        }
        
        // Check if this appears to be actual dialogue vs descriptive text
        const beforeChar = match.charAt(0);
        const isStartOfSentence = /^[A-Z]/.test(dialogue) || beforeChar.match(/[.!?]/);
        
        if (isStartOfSentence) {
          const quotedDialogue = `"${dialogue.trim()}"`;
          return match.replace(dialogue, quotedDialogue);
        }
        
        return match;
      });
    });
    
    return processedText;
  }

  /**
   * Post-process assistant text to enforce objective-only policy globally
   * @param {string} rawText - Raw AI response text
   * @param {string} userMessage - User message
   * @returns {string} - Processed text
   */
  static postProcessObjectiveContent(rawText, userMessage) {
    if (!rawText || typeof rawText !== 'string') return rawText;
    let text = rawText;

    // Minimal fallback processing - most rules now handled by system prompt
    // Only keep essential formatting that AI might miss occasionally
    
    // Ensure final line ends with the required phrase (fallback)
    if (!/Awaiting your next step\.?\s*$/.test(text)) {
      text = text.replace(/\s*$/m, '\n\nAwaiting your next step.');
    }

    return text.trim();
  }

  /**
   * Generate dispatch message with retry mechanism and validation
   * @param {string} rawContent - Raw AI content
   * @param {Object} scenarioData - Scenario data (optional)
   * @param {number} retryCount - Current retry attempt (0-2)
   * @param {number} seed - Randomization seed
   * @returns {string} - Processed content
   */
  static async enforceInitialDispatchMessage(rawContent, scenarioData = null, retryCount = 0, seed = null) {
    const maxRetries = 3;
    const startTime = Date.now();
    const timeoutMs = 5000; // 5 second timeout
    
    // Generate seed if not provided
    if (seed === null) {
      seed = Date.now() + Math.random() * 1000;
    }
    
    try {
      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        throw new Error('Dispatch generation timeout exceeded (5 seconds)');
      }
      
      const dispatch = await this.generateCompliantDispatch(rawContent, scenarioData, seed);
      
      // Validate content appropriateness
      if (!this.isContentAppropriate(dispatch)) {
        if (retryCount < maxRetries - 1) {
          console.log(`🔄 Content inappropriate, retrying (${retryCount + 1}/${maxRetries})`);
          return await this.enforceInitialDispatchMessage(rawContent, scenarioData, retryCount + 1, seed + 1);
        } else {
          throw new Error('Content filtering failed after 3 attempts');
        }
      }
      
      // Extract dispatch components for validation
      const dispatchMatch = dispatch.match(/You have been dispatched to a (\d+) year old (male|female) at ([^,]+), ([^f]+) for (.+?)\./i);
      if (dispatchMatch) {
        const [, age, gender, location, time, condition] = dispatchMatch;
        
        // Validate realism
        if (!this.isDispatchRealistic(parseInt(age), gender, location, condition)) {
          if (retryCount < maxRetries - 1) {
            console.log(`🔄 Unrealistic combination, retrying (${retryCount + 1}/${maxRetries})`);
            return await this.enforceInitialDispatchMessage(rawContent, scenarioData, retryCount + 1, seed + 1);
          } else {
            console.log('⚠️ Proceeding with potentially unrealistic combination after 3 attempts');
          }
        }
      }
      
      return dispatch;
      
    } catch (error) {
      if (retryCount < maxRetries - 1) {
        console.log(`🔄 Error occurred, retrying (${retryCount + 1}/${maxRetries}): ${error.message}`);
        return await this.enforceInitialDispatchMessage(rawContent, scenarioData, retryCount + 1, seed + 1);
      } else {
        console.error('❌ All retry attempts failed:', error.message);
        return `**Error:** Scenario generation failed after ${maxRetries} attempts. ${error.message}. Please refresh the page to try again.`;
      }
    }
  }

  /**
   * Generate compliant dispatch message according to requirements
   * @param {string} rawContent - Raw AI content
   * @param {Object} scenarioData - Scenario data (optional)
   * @param {number} seed - Randomization seed
   * @returns {string} - Compliant dispatch message
   */
  static async generateCompliantDispatch(rawContent, scenarioData = null, seed = 0) {
    try {
      // Generate truly random seed if not provided or if seed is 0
      if (!seed || seed === 0) {
        seed = Math.floor(Math.random() * 1000000) + Date.now();
      }
      
      // Determine scenario type from multiple sources for better variability
      let scenarioType = '';
      if (scenarioData?.subScenario) {
        scenarioType = scenarioData.subScenario.toLowerCase();
      } else if (scenarioData?.scenario) {
        scenarioType = scenarioData.scenario.toLowerCase();
      } else if (scenarioData?.type) {
        scenarioType = scenarioData.type.toLowerCase();
      } else {
        // If no scenario data, randomly pick a scenario type for variety
        const randomTypes = ['cardiac', 'respiratory', 'trauma', 'neurological', 'metabolic'];
        scenarioType = randomTypes[Math.abs(seed) % randomTypes.length];
      }
      
      console.log('🎭 Using scenario type for dispatch:', scenarioType);
      console.log('📊 Scenario data received:', JSON.stringify(scenarioData, null, 2));
      console.log('🎲 Generated seed:', seed);
      
      // Debug: Check if scenario type detection is working
      console.log('🔍 Scenario type checks:');
      console.log('  - includes cardiac:', scenarioType.includes('cardiac'));
      console.log('  - includes trauma:', scenarioType.includes('trauma'));
      console.log('  - includes respiratory:', scenarioType.includes('respiratory'));
      
      // Generate age based on scenario type and seed
      let age;
      console.log('🔍 Age generation - scenario type:', scenarioType);
      
      // Ensure seed is a valid number
      const validSeed = Math.floor(Math.abs(Number(seed))) || Math.floor(Math.random() * 1000);
      console.log('🎲 Valid seed for calculations:', validSeed);
      
      if (scenarioType.includes('cardiac') || scenarioType.includes('heart')) {
        console.log('✅ Matched cardiac scenario');
        const cardiacAges = [45, 52, 58, 63, 67, 71, 76];
        age = cardiacAges[validSeed % cardiacAges.length];
      } else if (scenarioType.includes('trauma') || scenarioType.includes('accident')) {
        console.log('✅ Matched trauma scenario');
        const traumaAges = [19, 25, 32, 28, 41, 35, 29, 47];
        age = traumaAges[validSeed % traumaAges.length];
      } else if (scenarioType.includes('respiratory') || scenarioType.includes('breathing') || scenarioType.includes('asthma')) {
        console.log('✅ Matched respiratory scenario');
        const respiratoryAges = [28, 34, 41, 48, 55, 62, 37];
        age = respiratoryAges[validSeed % respiratoryAges.length];
      } else if (scenarioType.includes('neurological') || scenarioType.includes('stroke') || scenarioType.includes('seizure')) {
        console.log('✅ Matched neurological scenario');
        const neuroAges = [52, 59, 66, 73, 45, 38, 61];
        age = neuroAges[validSeed % neuroAges.length];
      } else if (scenarioType.includes('metabolic') || scenarioType.includes('diabetes') || scenarioType.includes('hypoglycemic')) {
        console.log('✅ Matched metabolic scenario');
        const metabolicAges = [26, 33, 40, 47, 54, 61, 35];
        age = metabolicAges[validSeed % metabolicAges.length];
      } else {
        console.log('✅ Using general scenario ages');
        const generalAges = [23, 31, 38, 44, 51, 59, 66, 29, 42, 56];
        age = generalAges[validSeed % generalAges.length];
      }
      console.log('🎯 Generated age:', age);
      
      // Generate gender
      const genders = ['male', 'female'];
      const gender = genders[(validSeed + 1) % genders.length];
      console.log('👤 Generated gender:', gender);
      
      // Generate scenario-aware location
      const location = this.generateScenarioAwareLocation(scenarioType, validSeed + 2);
      console.log('📍 Generated location:', location);
      
      // Generate time
      const time = this.generateTime(validSeed + 3);
      console.log('⏰ Generated time:', time);
      
      // Generate somewhat specific condition based on scenario type
      let condition;
      if (scenarioType.includes('cardiac')) {
        const cardiacConditions = [
          'chest pain radiating to left arm',
          'chest discomfort with shortness of breath',
          'crushing chest pain and sweating',
          'chest tightness and nausea',
          'severe chest pain with dizziness',
          'chest pressure and jaw pain',
          'chest pain with back pain'
        ];
        condition = cardiacConditions[(validSeed + 4) % cardiacConditions.length];
      } else if (scenarioType.includes('respiratory')) {
        const respiratoryConditions = [
          'difficulty breathing with wheezing',
          'shortness of breath and chest tightness',
          'severe breathing difficulty',
          'respiratory distress with coughing',
          'unable to catch breath after exertion',
          'wheezing and chest pain',
          'difficulty breathing with blue lips'
        ];
        condition = respiratoryConditions[(validSeed + 4) % respiratoryConditions.length];
      } else if (scenarioType.includes('trauma')) {
        const traumaConditions = [
          'fall from ladder with possible head injury',
          'motor vehicle collision with chest pain',
          'sports injury with shoulder pain',
          'fall with possible leg fracture',
          'accident with multiple injuries',
          'bicycle accident with road rash',
          'workplace injury with back pain',
          'slip and fall with wrist injury',
          'construction accident with leg pain'
        ];
        condition = traumaConditions[(validSeed + 4) % traumaConditions.length];
      } else if (scenarioType.includes('neurological')) {
        const neuroConditions = [
          'sudden weakness on one side',
          'confusion and difficulty speaking',
          'severe headache with vision changes',
          'altered mental status',
          'dizziness with slurred speech',
          'sudden onset of confusion',
          'severe headache and nausea'
        ];
        condition = neuroConditions[(validSeed + 4) % neuroConditions.length];
      } else if (scenarioType.includes('metabolic')) {
        const metabolicConditions = [
          'confusion and dizziness',
          'altered mental status with sweating',
          'weakness and disorientation',
          'diabetic emergency symptoms',
          'excessive thirst and confusion',
          'shaking and sweating',
          'weakness with rapid breathing'
        ];
        condition = metabolicConditions[(validSeed + 4) % metabolicConditions.length];
      } else {
        // Mix of all condition types for variety
        const allConditions = [
          'chest pain and shortness of breath',
          'difficulty breathing with wheezing',
          'fall with possible head injury',
          'sudden weakness on left side',
          'confusion and dizziness',
          'abdominal pain and nausea',
          'severe back pain after lifting',
          'allergic reaction with swelling',
          'seizure activity witnessed',
          'unconscious and unresponsive'
        ];
        condition = allConditions[(validSeed + 4) % allConditions.length];
      }
      
      // Generate bystander info
      const bystanderInfo = this.generateBystanderInfo(location, validSeed + 5);
      console.log('🚨 Generated condition:', condition);
      
      // Build the compliant dispatch message
      console.log('🔧 Building dispatch with:', { age, gender, location, time, condition });
      let dispatchMessage = `**Dispatch Information:** You have been dispatched to a ${age} year old ${gender} at ${location}, ${time} for ${condition}.`;
      
      // Add bystander info if present
      if (bystanderInfo) {
        dispatchMessage += ` ${bystanderInfo}`;
      }
      
      dispatchMessage += '\n\nLet me know when you are ready to begin the scenario. It is recommended that you use voice input to practice your verbal communication skills.';
      
      return dispatchMessage;
      
    } catch (error) {
      console.error('❌ Error generating compliant dispatch:', error);
      // Fallback to basic dispatch
      return '**Dispatch Information:** You have been dispatched to a 45 year old male at 1425 El Camino Real, 2:30 PM for chest pain and shortness of breath.\n\nLet me know when you are ready to begin the scenario. It is recommended that you use voice input to practice your verbal communication skills.';
    }
  }

  /**
   * Build dispatch information from template-generated data (legacy support)
   * @param {Object} templateData - The template-generated scenario data
   * @returns {string} - Formatted dispatch information
   */
  static async buildDispatchFromTemplateData(templateData) {
    try {
      const dispatchInfo = templateData.dispatchInfo;
      const patientProfile = templateData.patientProfile;
      
      console.log('📋 Building dispatch from template data:', { dispatchInfo, patientProfile });
      
      // Extract the basic information
      const location = dispatchInfo.location || '1425 El Camino Real';
      const time = dispatchInfo.time || '2:30 PM';
      const mechanism = dispatchInfo.mechanism || 'chest pain and shortness of breath';
      
      // Build the dispatch message
      let dispatchLine = `**Dispatch Information:** You have been dispatched to a`;
      
      // Add patient info if available
      if (patientProfile?.age && patientProfile?.age !== 'unknown') {
        dispatchLine += ` ${patientProfile.age} year old`;
        if (patientProfile?.gender && patientProfile?.gender !== 'unknown') {
          dispatchLine += ` ${patientProfile.gender}`;
        }
      } else {
        dispatchLine += ` 45 year old male`;
      }
      
      dispatchLine += ` at ${location}, ${time} for ${mechanism}.`;
      
      console.log('✅ Generated dispatch message:', dispatchLine);
      
      return `${dispatchLine}\n\nLet me know when you are ready to begin the scenario. It is recommended that you use voice input to practice your verbal communication skills.`;
      
    } catch (error) {
      console.error('❌ Error building dispatch from template data:', error);
      return '**Dispatch Information:** You have been dispatched to a 45 year old male at 1425 El Camino Real, 2:30 PM for chest pain and shortness of breath.\n\nLet me know when you are ready to begin the scenario. It is recommended that you use voice input to practice your verbal communication skills.';
    }
  }

  /**
   * Build dispatch message from AI-generated scenario data (legacy support)
   * @param {Object} generatedScenario - Complete AI-generated scenario
   * @returns {string} - Formatted dispatch message
   */
  static async buildDispatchFromScenario(generatedScenario) {
    try {
      const { patientProfile, dispatchInfo } = generatedScenario;
      
      // Extract information with fallbacks
      const age = patientProfile?.age || '45';
      const gender = patientProfile?.gender || 'male';
      const location = dispatchInfo?.location || '1425 El Camino Real';
      
      // Ensure we have a proper time
      let time = dispatchInfo?.time || '2:30 PM';
      if (time.includes('<') || time.includes('>') || time === 'afternoon' || time === 'morning' || time === 'evening') {
        const times = ['2:15 PM', '10:30 AM', '4:45 PM', '11:20 AM', '3:30 PM', '1:45 PM', '9:15 AM', '5:20 PM', '12:30 PM', '8:45 AM'];
        const ageNum = parseInt(age) || 45;
        const timeIndex = (ageNum + gender.length) % times.length;
        time = times[timeIndex];
      }
      
      const mechanism = dispatchInfo?.mechanism || 'chest pain and shortness of breath';
      
      // Build the dispatch line with consistent format
      let dispatchLine = `**Dispatch Information:** You have been dispatched to a ${age} year old ${gender} at ${location}, ${time} for ${mechanism}.`;
      
      return `${dispatchLine}\n\nLet me know when you are ready to begin the scenario. It is recommended that you use voice input to practice your verbal communication skills.`;
    } catch (error) {
      console.error('❌ Error building dispatch from scenario:', error);
      return '**Dispatch Information:** You have been dispatched to a 45 year old male at 1425 El Camino Real, 2:30 PM for chest pain and shortness of breath.\n\nLet me know when you are ready to begin the scenario. It is recommended that you use voice input to practice your verbal communication skills.';
    }
  }
}

module.exports = PostProcessor;
