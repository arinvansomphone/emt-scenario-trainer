// services/scenarioGenerator.js
const { openai } = require('../config/openai');
const TextNormalizer = require('./utils/textNormalizer');

class ScenarioGenerator {
  constructor() {
    this.defaultModel = 'gpt-4o-mini';
    this.maxTokens = 1200;
    this.temperature = 0.9; // Higher temperature for increased variability
  }

  /**
   * Generate a comprehensive EMT scenario with all details
   * @param {Object} scenarioData - Basic scenario requirements
   * @returns {Object} - Complete scenario with all components
   */
  async generateCompleteScenario(scenarioData) {
    console.log('🎭 Generating complete scenario...');
    console.log('📋 Input scenario data:', scenarioData);

    // Generate simple difficulty for this scenario
    const difficulty = this.generateSimpleDifficulty(scenarioData);
    console.log('🎲 Generated difficulty:', difficulty.level);

    try {
      const prompt = this.buildScenarioPrompt(scenarioData, difficulty);
      const response = await this.callOpenAI(prompt);
      const parsedScenario = this.parseScenarioResponse(response);
      
      // Add difficulty information to the scenario
      parsedScenario.difficulty = difficulty;
      
      console.log('✅ Scenario generation successful');
      return {
        ...scenarioData,
        generatedScenario: parsedScenario
      };
    } catch (error) {
      console.error('❌ Scenario generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate simple difficulty configuration
   * @param {Object} scenarioData - Basic scenario data for seeding
   * @returns {Object} - Simple difficulty configuration
   */
  generateSimpleDifficulty(scenarioData = {}) {
    const levels = ['novice', 'intermediate', 'advanced'];
    
    // Random difficulty selection for greater variability
    // Math.random() gives us a value between 0 and 1
    // We can use this to randomly select a difficulty level
    const randomIndex = Math.floor(Math.random() * levels.length);
    const level = levels[randomIndex];
    
    return {
      level: level,
      name: level.charAt(0).toUpperCase() + level.slice(1),
      description: this.getDifficultyDescription(level)
    };
  }

  /**
   * Get description for each difficulty level
   * @param {string} level - Difficulty level
   * @returns {string} - Difficulty description
   */
  getDifficultyDescription(level) {
    const descriptions = {
      novice: 'Stable patient with clear symptoms, responsive to treatment',
      intermediate: 'Moderately distressed patient with some complications',
      advanced: 'Critical patient with multiple issues and rapid changes'
    };
    
    return descriptions[level] || descriptions.intermediate;
  }

  /**
   * Get scenario type enforcement string to ensure proper category matching
   * @param {string} subScenario - The selected sub-scenario
   * @returns {string} - Enforcement description
   */
  getScenarioTypeEnforcement(subScenario) {
    const traumaScenarios = [
      'MVC Scenario', 'Fall Scenario', 'Assault Scenario', 'Sport Injury Scenario',
      'Stabbing Scenario', 'GSW Scenario', 'Burn Scenario', 'Trauma Scenario'
    ];
    
    const medicalScenarios = [
      'Respiratory Scenario', 'Cardiac Scenario', 'Neurologic Scenario', 
      'Metabolic Scenario', 'Abdominal Scenario', 'Environmental Scenario',
      'OB/GYN Scenario', 'Medical Scenario'
    ];

    if (traumaScenarios.includes(subScenario)) {
      return 'TRAUMA/INJURY scenario with a specific mechanism of injury (fall, collision, assault, etc.)';
    } else if (medicalScenarios.includes(subScenario)) {
      return 'MEDICAL scenario with illness/disease process (NOT trauma or injury)';
    } else {
      return 'medical or trauma scenario as appropriate';
    }
  }

  /**
   * Build the prompt for comprehensive scenario generation
   * @param {Object} scenarioData - Basic scenario requirements
   * @param {Object} difficulty - Difficulty configuration
   * @returns {Array} - OpenAI messages array
   */
  buildScenarioPrompt(scenarioData, difficulty) {
    // Handle null or missing scenarioData
    if (!scenarioData) {
      const scenarioTypes = ['Cardiac Scenario', 'Respiratory Scenario', 'Trauma Scenario', 'Neurological Scenario', 'Metabolic Scenario'];
      const randomType = scenarioTypes[Math.floor(Math.random() * scenarioTypes.length)];
      scenarioData = {
        mainScenario: randomType,
        subScenario: randomType,
        sunetId: null
      };
    }
    
    const { mainScenario, subScenario, sunetId } = scenarioData;

    const systemPrompt = `You are an expert EMT instructor creating realistic training scenarios. Generate a comprehensive, medically accurate EMT scenario that includes all necessary details for training.

🚨 SCENARIO CATEGORY & SUBCATEGORY ENFORCEMENT 🚨
- You MUST match BOTH the requested category (medical vs trauma) AND the specific subcategory (e.g., Fall Scenario, Cardiac Scenario). Do not substitute.
- If TRAUMA (MVC, Fall, Assault, Sport Injury, Stabbing, GSW, Burn), create a trauma scenario with physical injuries from an external mechanism.
- If MEDICAL (Cardiac, Respiratory, Neurologic, Metabolic, Abdominal, Environmental, OB/GYN), create a medical scenario with an illness/disease process.
- NEVER mix categories. The primary problem MUST align with the requested subcategory.

CRITICAL: Return your response as a valid JSON object with the exact structure shown below. Do not include any text before or after the JSON.

Required JSON structure:
{
  "patientProfile": {
    "age": <number>,
    "gender": "<male/female>",
    "medicalHistory": ["<relevant conditions>"],
    "medications": ["<current medications>"],
    "allergies": ["<known allergies>"]
  },
  "presentation": {
    "chiefComplaint": "<primary complaint>",
    "onsetTime": "<when symptoms started>",
    "severity": "<mild/moderate/severe>",
    "location": "<where symptoms occur>",
    "description": "<detailed symptom description>"
  },
  "vitals": {
    "baseline": {
      "heartRate": <number>,
      "respiratoryRate": <number>,
      "bloodPressureSystolic": <number>,
      "bloodPressureDiastolic": <number>,
      "temperature": <number>,
      "spO2": <number>
    },
    "expectedRanges": {
      "heartRate": {"min": <number>, "max": <number>},
      "respiratoryRate": {"min": <number>, "max": <number>},
      "bloodPressure": {"systolicMin": <number>, "systolicMax": <number>, "diastolicMin": <number>, "diastolicMax": <number>},
      "temperature": {"min": <number>, "max": <number>},
      "spO2": {"min": <number>, "max": <number>}
    }
  },
  "physicalFindings": {
    "generalAppearance": "<overall patient appearance>",
    "consciousness": "<alert/confused/unresponsive>",
    "airway": "<clear/compromised>",
    "breathing": "<normal/labored/absent>",
    "circulation": "<strong/weak/absent pulses>",
    "skin": "<color, temperature, moisture>"
  },
  "dispatchInfo": {
    "location": "<specific location type>",
    "time": "<REQUIRED: specific time in format like '2:15 PM', '10:30 AM', etc. - NOT '<current time>' or placeholders>",
    "callerInfo": "<who called 911>",
    "mechanism": "<REQUIRED: specific mechanism of injury OR observable symptoms - provide key symptoms without excessive detail. NO MEDICAL HISTORY. Examples: 'fell from ladder complaining of back pain', 'chest pain and shortness of breath', 'difficulty breathing after bee sting'>"
  },
  "expectedFindings": {
    "inspection": "<what EMTs should observe>",
    "palpation": "<what EMTs should feel>",
    "auscultation": "<what EMTs should hear if they listen>"
  },
  "emtInterventions": {
    "immediate": ["<critical interventions needed right away>"],
    "primary": ["<standard interventions for this condition>"],
    "monitoring": ["<ongoing assessments to perform>"],
    "contraindications": ["<interventions to avoid>"],
    "medications": ["<appropriate EMT-level medications if any>"],
    "equipment": ["<specific equipment needed>"],
    "transportDecision": "<BLS/ALS/urgent transport recommendation>"
  }
}`;

    // Create a unique seed for each scenario to ensure variability
    const uniqueSeed = Math.floor(Math.random() * 1000000);
    
    // Generate patient demographics with more variability
    const patientAgeGroups = [
      "child (5-12)", "teenager (13-19)", "young adult (20-35)", 
      "middle-aged (36-55)", "older adult (56-70)", "elderly (71+)"
    ];
    const selectedAgeGroup = patientAgeGroups[Math.floor(Math.random() * patientAgeGroups.length)];
    
    // Generate more varied location types
    const locationTypes = [
      "residential home", "apartment complex", "office building", 
      "shopping mall", "restaurant", "public park", "sports facility",
      "school", "college campus", "retirement community", "highway",
      "rural road", "hiking trail", "beach", "industrial site"
    ];
    const selectedLocation = locationTypes[Math.floor(Math.random() * locationTypes.length)];
    
    const userPrompt = `Create a realistic ${subScenario} scenario for EMT training. 

🚨 MANDATORY REQUIREMENT: This MUST be a ${this.getScenarioTypeEnforcement(subScenario)} case.
🚨 REJECT any medical illness scenarios if this is a trauma scenario.
🚨 REJECT any trauma/injury scenarios if this is a medical scenario.

${subScenario === 'MVC Scenario' ? '🚗 MVC SCENARIO REQUIREMENTS: Must involve a motor vehicle collision/crash with resulting injuries. Examples: car vs car, car vs tree, rollover, pedestrian vs vehicle.' : ''}
${subScenario.includes('Trauma') || ['MVC Scenario', 'Fall Scenario', 'Assault Scenario', 'Sport Injury Scenario', 'Stabbing Scenario', 'GSW Scenario', 'Burn Scenario'].includes(subScenario) ? '⚠️ TRAUMA SCENARIO: Patient must have sustained physical injuries from an external mechanism. NO illness, disease, or medical conditions.' : ''}
${subScenario.includes('Medical') || ['Respiratory Scenario', 'Cardiac Scenario', 'Neurologic Scenario', 'Metabolic Scenario', 'Abdominal Scenario', 'Environmental Scenario', 'OB/GYN Scenario'].includes(subScenario) ? '🏥 MEDICAL SCENARIO: Patient must have illness/disease process. NO trauma, injuries, or external mechanisms.' : ''}

DIFFICULTY LEVEL: ${difficulty.name.toUpperCase()} (${difficulty.description})

SCENARIO VARIATION PARAMETERS:
- Patient demographic focus: ${selectedAgeGroup}
- Location setting: ${selectedLocation}
- Scenario seed: ${uniqueSeed}

Requirements:
- Medically accurate and realistic
- Appropriate for EMT-level training (Basic Life Support scope)
- Include realistic vital signs for the condition
- Create a believable patient presentation with UNIQUE characteristics
- Ensure all findings are consistent with the condition
- Make it challenging but appropriate for student learning
- Include appropriate EMT interventions and treatment protocols
- Consider EMT scope of practice limitations
- Provide realistic equipment and medication options
- Include proper transport decision criteria
- IMPORTANT: Create VARIED and UNIQUE scenario details that differ from standard textbook examples
- CRITICAL: Generate a specific time of day (e.g., "2:15 PM", "10:30 AM") - do NOT use placeholders
- ABSOLUTELY CRITICAL: The scenario MUST match the selected category - ${this.getScenarioTypeEnforcement(subScenario)}

DISPATCH INFORMATION GUIDELINES - CRITICAL:
- ALWAYS include specific mechanism of injury OR observable symptoms in the dispatch
- ALWAYS include a specific time (e.g., "2:15 PM", "10:30 AM", "4:45 PM") - NEVER use placeholders like "<current time>"
- NEVER use generic terms like "requiring medical attention" or "medical emergency"
- NEVER include medical history, past conditions, or chronic illness information
- Use specific, observable symptoms rather than diagnostic terms
- Avoid medical jargon that 911 callers wouldn't know
- Keep dispatch information CONCISE - limit to 1-2 main observable complaints
- The mechanism field must give EMTs useful information to prepare for the call WITHOUT giving away the diagnosis
- Focus only on immediate, observable symptoms or mechanism of current incident

Examples of EXCELLENT dispatch reasons by SCENARIO TYPE:

TRAUMA SCENARIOS - MANDATORY DISPATCH FORMATS (MVC, Fall, Assault, Sport Injury, Stabbing, GSW, Burn):
  * MVC: "motor vehicle collision, chest pain" | "car accident, leg pain" | "collision on highway, back pain" | "vehicle rollover, head injury"
  * FALL: "fell from ladder, back pain" | "fall from roof, leg pain" | "fell down stairs, hip pain"
  * ASSAULT: "stabbed in abdomen, conscious" | "assault victim, head injury" | "beaten with object, arm injury"
  * SPORT: "bicycle accident, head injury" | "football injury, shoulder pain" | "skiing accident, leg injury"
  * BURN: "burned in kitchen fire, arm burns" | "house fire victim, face burns" | "chemical burn, hand injury"
  * GSW: "gunshot wound to leg, conscious" | "shooting victim, chest wound" | "gunshot to arm, alert"

⚠️ TRAUMA DISPATCH RULE: ALL trauma dispatches MUST include mechanism of injury (collision, fall, stabbing, etc.) + resulting pain/injury location.

MEDICAL SCENARIOS (Cardiac, Respiratory, Neurologic, Metabolic, Abdominal, Environmental, OB/GYN):
  * CARDIAC: "chest pain and shortness of breath"
  * CARDIAC: "chest pain, sweating"
  * RESPIRATORY: "difficulty breathing"
  * RESPIRATORY: "trouble breathing, wheezing"
  * NEUROLOGIC: "sudden weakness on one side"
  * NEUROLOGIC: "confusion and slurred speech"
  * METABOLIC: "confusion and dizziness"
  * METABOLIC: "diabetic emergency, unconscious"
  * ABDOMINAL: "severe stomach pain"
  * ABDOMINAL: "vomiting blood"
  * ENVIRONMENTAL: "difficulty breathing after bee sting"
  * ENVIRONMENTAL: "heat exhaustion, dizzy"
  * OB/GYN: "pregnant woman, contractions"
  * SEIZURE: "seizure, now awake"
  * OVERDOSE: "unconscious, found by family"

Examples of BAD dispatch (avoid these - TOO DETAILED):
  * "chest pain radiating to left arm with nausea" - TOO MUCH DETAIL
  * "fell from ladder, back pain and unable to move legs" - TOO MUCH DETAIL
  * "difficulty breathing, wheezing, and chest tightness" - TOO MUCH DETAIL
  * "severe crushing chest pain with diaphoresis" - TOO CLINICAL/DETAILED

Examples of BAD dispatch (avoid these - TOO VAGUE):
  * "requiring medical attention" - TOO VAGUE
  * "medical emergency" - TOO VAGUE  
  * "neurological symptoms" - TOO CLINICAL/VAGUE
  * "respiratory distress" - TOO CLINICAL/VAGUE

Examples of BAD dispatch (avoid these - INCLUDES HISTORY):
  * "confusion and dizziness, history of diabetes" - NO HISTORY
  * "chest pain, known cardiac patient" - NO HISTORY
  * "difficulty breathing, has asthma" - NO HISTORY
  * "seizure, previous seizure disorder" - NO HISTORY
  * "fall from ladder, osteoporosis patient" - NO HISTORY

DISPATCH CONTENT RULES FOR ALL SCENARIOS:
- Keep it realistic to what a 911 caller would actually report
- Provide enough detail to get EMTs thinking about possible conditions
- Limit to 1-2 main complaints maximum - no exhaustive symptom lists
- Focus on what the caller can observe, not medical interpretation
- Give enough info to prepare equipment/mindset, not enough to diagnose
- ABSOLUTELY NO medical history, past conditions, chronic illnesses, or previous episodes
- Only report immediate, current symptoms or mechanism of current incident

DIFFICULTY-SPECIFIC REQUIREMENTS:
${this.getDifficultyInstructions(difficulty)}

CRITICAL: For EMT Interventions, consider:
- EMT-Basic scope of practice only
- Appropriate oxygen therapy options
- Basic airway management
- Hemorrhage control
- Immobilization techniques
- Vital sign monitoring
- BLS medications (oxygen, aspirin, glucose, epinephrine auto-injector, etc.)
- When to call for ALS intercept
- Appropriate transport destination and urgency

Generate the complete scenario now as JSON only.`;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
  }

  /**
   * Get difficulty-specific instructions for scenario generation
   * @param {Object} difficulty - Difficulty configuration
   * @returns {string} - Difficulty instructions
   */
  getDifficultyInstructions(difficulty) {
    const instructions = {
      novice: `
- Create a STABLE patient who responds well to treatment
- Use CLEAR, obvious signs and symptoms
- Patient should be COOPERATIVE and communicative
- Vitals should improve quickly with appropriate interventions
- Make the diagnosis straightforward for students
- Include encouraging patient responses to build confidence
- Avoid complications or rapid deterioration
- Patient should give clear, helpful answers to assessment questions
- IMPORTANT: Add at least one UNIQUE or INTERESTING element to make this scenario memorable
- Consider including a minor complication that's easy to manage but adds realism`,

      intermediate: `
- Create a MODERATELY DISTRESSED patient with some challenges
- Include multiple symptoms that require prioritization
- Patient may be somewhat anxious but generally cooperative
- Vitals may fluctuate and require monitoring
- Include some clinical decision-making challenges
- Patient responses should require some probing
- Introduce minor complications or changes in condition
- Test students' ability to adapt their treatment plan
- Create a scenario with ATYPICAL presentation of a common condition
- Include a social or environmental factor that complicates care
- Consider adding a communication challenge (language barrier, hearing impairment, etc.)`,

      advanced: `
- Create a CRITICALLY ILL patient with complex presentation
- Include MULTIPLE competing priorities and time pressure
- Patient may be confused, anxious, or difficult to assess
- Vitals should be unstable and potentially deteriorating
- Include complications that require advanced thinking
- Patient responses may be unclear or inconsistent
- Create scenarios requiring ALS intercept decisions
- Challenge students with resource and time limitations
- Include potential for rapid deterioration if not treated properly
- Create a scenario with RARE or COMPLEX presentations that require critical thinking
- Include a bystander, family member, or scene safety factor that complicates care
- Consider adding an unexpected complication during treatment
- Design a scenario where standard protocols may need creative adaptation`
    };

    return instructions[difficulty.level] || instructions.intermediate;
  }

  /**
   * Call OpenAI to generate the scenario
   * @param {Array} messages - OpenAI messages array
   * @returns {string} - Raw response from OpenAI
   */
  async callOpenAI(messages) {
    console.log('🚀 Calling OpenAI for scenario generation...');

    try {
      const completion = await openai.chat.completions.create({
        model: this.defaultModel,
        messages: messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        top_p: 0.95, // Use nucleus sampling for more diverse outputs
        frequency_penalty: 0.3, // Reduce repetition of similar scenario patterns
        presence_penalty: 0.3 // Encourage the model to introduce novel elements
      });

      const response = completion.choices[0]?.message?.content || '';
      console.log('✅ OpenAI scenario generation successful');
      return response;
    } catch (error) {
      console.error('❌ OpenAI scenario generation failed:', error);
      throw error;
    }
  }

  /**
   * Parse the OpenAI response into structured scenario data
   * @param {string} response - Raw response from OpenAI
   * @returns {Object} - Parsed scenario object
   */
  parseScenarioResponse(response) {
    try {
      // Handle null, undefined, or empty input
      if (!response || typeof response !== 'string') {
        console.log('⚠️  Invalid response input, using fallback scenario');
        return this.generateFallbackScenario();
      }

      // Clean the response to extract JSON
      let cleanResponse = response.trim();
      
      // Remove any markdown code blocks if present
      cleanResponse = cleanResponse.replace(/```json\s*|\s*```/g, '');
      
      // Find JSON object boundaries
      const jsonStart = cleanResponse.indexOf('{');
      const jsonEnd = cleanResponse.lastIndexOf('}') + 1;
      
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        cleanResponse = cleanResponse.substring(jsonStart, jsonEnd);
      }

      // Fix smart quotes, comments, and other common JSON issues
      cleanResponse = cleanResponse
        // First remove comments (before other processing)
        .replace(/\/\/[^\n\r]*/g, '')  // Remove // comments
        .replace(/\/\*[\s\S]*?\*\//g, '')  // Remove /* */ comments
        // Fix smart quotes and other characters
        .replace(/[""]/g, '"')  // Replace smart quotes with regular quotes
        .replace(/['']/g, "'")  // Replace smart single quotes with regular single quotes
        // Convert single-quoted property names to double-quoted (JSON requirement)
        .replace(/'([^']+)':/g, '"$1":')  // Convert 'property': to "property":
        .replace(/…/g, '...')   // Replace ellipsis with three dots
        // Handle trailing commas more carefully
        .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas before } or ]
        .replace(/,(\s*\n\s*[}\]])/g, '$1')  // Remove trailing commas before } or ] on new lines
        // Clean up whitespace last
        .replace(/\s+/g, ' ')   // Normalize whitespace
        .trim();

      const parsedScenario = JSON.parse(cleanResponse);
      console.log('✅ Scenario parsing successful');
      return parsedScenario;
    } catch (error) {
      console.error('❌ Failed to parse scenario response:', error);
      console.error('Raw response:', response);
      
      // Return a failure message
      return this.generateFailureMessage();
    }
  }

  /**
   * Generate a failure message when scenario parsing fails
   * @returns {Object} - Failure message structure
   */
  generateFailureMessage() {
    console.log('❌ Scenario generation failed');
    
    return {
      error: true,
      message: 'Failure to generate scenario',
      details: 'The AI was unable to generate a properly formatted scenario. Please try again.'
    };
  }

  /**
   * Validate that a scenario has all required components
   * @param {Object} scenario - Generated scenario
   * @returns {boolean} - True if valid
   */
  validateScenario(scenario) {
    const requiredKeys = [
      'patientProfile', 'presentation', 'vitals', 
      'physicalFindings', 'dispatchInfo', 'expectedFindings', 'emtInterventions'
    ];

    return requiredKeys.every(key => 
      scenario && typeof scenario === 'object' && scenario.hasOwnProperty(key)
    );
  }
}

module.exports = ScenarioGenerator;

