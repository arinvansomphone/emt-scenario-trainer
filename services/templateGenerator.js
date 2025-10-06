// services/templateGenerator.js
const OpenAI = require('openai');

// Initialize OpenAI with proper error handling
let openai;
try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
} catch (error) {
  console.error('❌ Failed to initialize OpenAI:', error);
  openai = null;
}

class TemplateGenerator {
  constructor() {
    this.openai = openai;
  }

  /**
   * Generate a dispatch template prompt for the AI to fill
   * @param {string} scenarioType - Type of scenario (e.g., 'Cardiac Scenario')
   * @returns {string} - Template prompt
   */
  generateDispatchTemplate(scenarioType) {
    const traumaScenarios = ['MVC Scenario', 'Fall Scenario', 'Assault Scenario', 'Sport Injury Scenario', 'Stabbing Scenario', 'GSW Scenario', 'Burn Scenario'];
    const isTrauma = traumaScenarios.includes(scenarioType);
    
    const categoryRequirement = isTrauma 
      ? `🚨 TRAUMA SCENARIO REQUIREMENT: This MUST be a trauma/injury scenario with physical injuries from external mechanisms (collision, fall, stabbing, etc.). NO medical illness or disease processes.`
      : `🚨 MEDICAL SCENARIO REQUIREMENT: This MUST be a medical scenario with illness/disease processes. NO trauma, injuries, or external mechanisms.`;
    
    const mechanismExamples = isTrauma
      ? this.getTraumaMechanismExamples(scenarioType)
      : this.getMedicalMechanismExamples(scenarioType);
    
    return `Generate dispatch information for a ${scenarioType}. 

${categoryRequirement}

${mechanismExamples}

Fill in this template with realistic details:

{
  "location": "[specific non-medical location where incident occurred - DO NOT use or reference hospitals, ERs, medical centers, clinics, urgent care, dialysis centers, doctor's offices, nursing homes, skilled nursing facilities, rehabilitation facilities, or any medical facilities. Use locations like 'shopping mall food court', 'hiking trail near Pine Ridge Park', 'residential home on Oak Street', 'office building', 'park', 'restaurant', 'gym', 'school', 'warehouse', etc.]",
  "time": "[time in format like '2:30 PM', '10:45 AM', '4:15 PM' - NOT 'afternoon', 'morning', or '<current time>']",
  "callerInfo": "[who called 911 - choose ONE: 'A coworker called 911 and is present on scene as well.' OR 'A friend called 911 and is present on scene as well.' OR 'A family member called 911 and is present on scene as well.' OR 'A bystander called 911 and is present on scene as well.' OR 'The patient called 911 themselves.']",
  "mechanism": "[what a 911 caller would actually say - use layperson language, NOT medical terminology. Examples: 'car accident, someone hurt' NOT 'MVC with possible injuries', 'chest pain and trouble breathing' NOT 'cardiac event', 'fell down stairs' NOT 'trauma to extremities']"
}

CRITICAL REQUIREMENTS:
- Time must be in specific format (e.g., "2:30 PM") - no placeholders
- Mechanism must be what a 911 caller would actually say (layperson language)
- Location must be a specific non-medical place, not generic and not any healthcare facility
- CallerInfo must be one of the four provided options
- All fields are required

Return ONLY the JSON object, no additional text or comments.`;
  }

  /**
   * Generate a complete dispatch template prompt for the AI to fill
   * @param {string} scenarioType - Type of scenario (e.g., 'Cardiac Scenario')
   * @returns {string} - Template prompt
   */
  generateCompleteDispatchTemplate(scenarioType) {
    const traumaScenarios = ['MVC Scenario', 'Fall Scenario', 'Assault Scenario', 'Sport Injury Scenario', 'Stabbing Scenario', 'GSW Scenario', 'Burn Scenario'];
    const isTrauma = traumaScenarios.includes(scenarioType);
    
    const categoryRequirement = isTrauma 
      ? `🚨 TRAUMA SCENARIO REQUIREMENT: This MUST be a trauma/injury scenario with physical injuries from external mechanisms (collision, fall, stabbing, etc.). NO medical illness or disease processes.`
      : `🚨 MEDICAL SCENARIO REQUIREMENT: This MUST be a medical scenario with illness/disease processes. NO trauma, injuries, or external mechanisms.`;
    
    const mechanismExamples = isTrauma
      ? this.getTraumaMechanismExamples(scenarioType)
      : this.getMedicalMechanismExamples(scenarioType);
    
    return `Generate complete dispatch information for a ${scenarioType}. 

${categoryRequirement}

${mechanismExamples}

Fill in this template with realistic details:

{
  "age": "[patient age - choose appropriate age for scenario type. Cardiac: 45-75, Trauma: 18-50, Respiratory: 25-65, Neurologic: 40-70, Metabolic: 25-60, General: 20-70]",
  "gender": "[patient gender - 'male' or 'female']",
  "location": "[Santa Clara–centric named POI or specific non-medical place (no house numbers); NEVER a hospital, ER, clinic, urgent care, dialysis center, doctor's office, nursing facility, or any healthcare facility]",
  "time": "[time in format like '3:20pm' or '11:50pm' (lowercase, no space)]",
  "callerInfo": "[one of: 'A coworker called 911 and is present on scene as well.' | 'A friend called 911 and is present on scene as well.' | 'A family member called 911 and is present on scene as well.' | 'A bystander called 911 and is present on scene as well.' | 'The patient called 911 themselves.']",
  "symptoms": "[for medical scenarios: patient's symptoms in medical dispatch format]",
  "mechanism": "[for trauma scenarios: layperson phrasing of what happened, e.g., 'fell down stairs, leg pain']"
}

CRITICAL REQUIREMENTS:
- Scenario MUST match requested category AND specific subcategory
- Age must be appropriate for the scenario type and realistic
- Gender must be 'male' or 'female'
- Time must be lowercase hh:mmam/pm (e.g., "3:20pm") - no placeholders
- Medical scenarios: use symptoms
- Trauma scenarios: use mechanism (layperson phrasing)
- Location must be Santa Clara–centric named POI or specific non-medical place; avoid house numbers; absolutely no hospitals or medical facilities
- CallerInfo must be one of the four provided options
- All fields are required

Return ONLY the JSON object, no additional text or comments.`;
  }

  /**
   * Enhanced validation for dispatch information
   * @param {Object} dispatchData - The dispatch data to validate
   * @param {string} scenarioType - The scenario type for context
   * @returns {Object} - Validation result with errors and suggestions
   */
  validateDispatchData(dispatchData, scenarioType) {
    const errors = [];
    const suggestions = [];
    
    // Validate age
    if (!dispatchData.age) {
      errors.push('Missing age');
    } else {
      const age = parseInt(dispatchData.age);
      if (isNaN(age) || age < 1 || age > 120) {
        errors.push('Invalid age value');
      }
      
      // Check age appropriateness for scenario
      const scenarioTypeLower = scenarioType.toLowerCase();
      if (scenarioTypeLower.includes('cardiac') && (age < 45 || age > 75)) {
        suggestions.push('Consider age 45-75 for cardiac scenarios');
      } else if (scenarioTypeLower.includes('trauma') && (age < 18 || age > 50)) {
        suggestions.push('Consider age 18-50 for trauma scenarios');
      }
    }
    
    // Validate gender
    if (!dispatchData.gender || !['male', 'female'].includes(dispatchData.gender.toLowerCase())) {
      errors.push('Invalid gender - must be "male" or "female"');
    }
    
    // Validate location
    if (!dispatchData.location || dispatchData.location.length < 10) {
      errors.push('Location too generic or missing');
    } else {
      const loc = String(dispatchData.location).toLowerCase();
      // Reject hospitals, ERs, clinics, urgent cares, and other medical facilities
      const medicalFacilityTerms = [
        'hospital', 'medical center', 'med center', 'med ctr', 'clinic', 'urgent care',
        'emergency department', 'emergency room', 'er', 'ed', 'dialysis', "doctor's office",
        'doctors office', 'physician office', 'nursing home', 'skilled nursing', 'snf',
        'rehab', 'rehabilitation center', 'hospice', 'surgery center', 'ambulatory surgery',
        'health center', 'care center'
      ];
      const containsMedicalFacility = medicalFacilityTerms.some(term => loc.includes(term));
      if (containsMedicalFacility) {
        errors.push('Invalid location - cannot be any hospital, clinic, or medical facility');
        suggestions.push('Use a non-medical location such as a home, park, school, workplace, store, or public area');
      }
    }
    
    // Validate time format (lowercase hh:mmam/pm)
    const timeRegex = /^(1[0-2]|[1-9]):[0-5][0-9](am|pm)$/;
    if (!dispatchData.time || !timeRegex.test(dispatchData.time)) {
      errors.push('Invalid time format - use format like "3:20pm"');
    }
    
    // Validate symptoms/mechanism based on scenario type
    const lowerType = (scenarioType || '').toLowerCase();
    const isTrauma = /mvc|fall|assault|stabbing|gsw|burn|trauma/.test(lowerType);
    if (isTrauma) {
      if (!dispatchData.mechanism) {
        errors.push('Missing mechanism for trauma scenario');
      }
    } else {
      if (!dispatchData.symptoms) {
        errors.push('Missing symptoms for medical scenario');
      } else {
        const symptoms = dispatchData.symptoms.toLowerCase();
        const callerTerms = ['my dad', 'my mom', 'my husband', 'my wife', 'my brother', 'my sister', 'he\'s', 'she\'s', 'he is', 'she is'];
        const hasCallerTerms = callerTerms.some(term => symptoms.includes(term));
        if (hasCallerTerms) {
          errors.push('Symptoms contain caller quotes - should be medical description');
          suggestions.push('Use medical terminology like "confusion and slurred speech" instead of caller quotes');
        }
        if (symptoms.length < 10) {
          suggestions.push('Symptoms description could be more detailed');
        }
      }
    }
    
    // Validate caller info
    const validCallerOptions = [
      'A coworker called 911 and is present on scene as well.',
      'A friend called 911 and is present on scene as well.',
      'A family member called 911 and is present on scene as well.',
      'A bystander called 911 and is present on scene as well.',
      'The patient called 911 themselves.'
    ];
    
    if (!dispatchData.callerInfo || !validCallerOptions.includes(dispatchData.callerInfo)) {
      errors.push('Invalid caller info - must be one of the specified options');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      suggestions,
      score: Math.max(0, 100 - (errors.length * 20) - (suggestions.length * 5))
    };
  }

  /**
   * Generate fallback dispatch data for when AI generation fails
   * @param {string} scenarioType - The scenario type
   * @returns {Object} - Fallback dispatch data
   */
  generateFallbackDispatch(scenarioType) {
    const scenarioTypeLower = scenarioType.toLowerCase();
    
    // Determine appropriate age range
    let age;
    if (scenarioTypeLower.includes('cardiac')) {
      age = '58';
    } else if (scenarioTypeLower.includes('trauma')) {
      age = '32';
    } else if (scenarioTypeLower.includes('respiratory')) {
      age = '45';
    } else if (scenarioTypeLower.includes('neurologic')) {
      age = '62';
    } else if (scenarioTypeLower.includes('metabolic')) {
      age = '38';
    } else {
      age = '45';
    }
    
    // Determine appropriate symptoms
    let symptoms;
    if (scenarioTypeLower.includes('cardiac')) {
      symptoms = 'chest pain and shortness of breath';
    } else if (scenarioTypeLower.includes('respiratory')) {
      symptoms = 'difficulty breathing with wheezing';
    } else if (scenarioTypeLower.includes('neurologic')) {
      symptoms = 'confusion and slurred speech';
    } else if (scenarioTypeLower.includes('metabolic')) {
      symptoms = 'confusion and dizziness';
    } else if (scenarioTypeLower.includes('abdominal')) {
      symptoms = 'severe abdominal pain';
    } else {
      symptoms = 'medical emergency';
    }
    
    return {
      age: age,
      gender: 'male',
      location: 'residential home on Oak Street',
      time: '2:30 PM',
      callerInfo: 'A family member called 911 and is present on scene as well.',
      symptoms: symptoms
    };
  }

  /**
   * Get trauma mechanism examples for specific scenario types
   * @param {string} scenarioType - Type of trauma scenario
   * @returns {string} - Examples for trauma mechanisms
   */
  getTraumaMechanismExamples(scenarioType) {
    const examples = {
      'MVC Scenario': 'Examples: "car accident, someone hurt" | "two cars crashed, driver injured" | "vehicle collision, passenger hurt"',
      'Fall Scenario': 'Examples: "fell from ladder, back hurts" | "fell down stairs, leg injury" | "fell off roof, someone hurt"',
      'Stabbing Scenario': 'Examples: "someone got stabbed, bleeding" | "knife attack, person injured" | "stabbing, victim hurt"',
      'Assault Scenario': 'Examples: "someone got beaten up, head injury" | "assault, person hurt" | "attack, victim injured"',
      'Sport Injury Scenario': 'Examples: "football injury, shoulder hurt" | "bicycle crash, head injury" | "skiing accident, leg broken"',
      'GSW Scenario': 'Examples: "gunshot, someone shot" | "shooting, person injured" | "gunshot wound, victim hurt"',
      'Burn Scenario': 'Examples: "kitchen fire, someone burned" | "house fire, burns" | "chemical burn, hand injured"'
    };
    return examples[scenarioType] || 'Examples: "injury from accident, someone hurt"';
  }

  /**
   * Get medical mechanism examples for specific scenario types
   * @param {string} scenarioType - Type of medical scenario
   * @returns {string} - Examples for medical mechanisms
   */
  getMedicalMechanismExamples(scenarioType) {
    const examples = {
      'Cardiac Scenario': 'Examples: "chest pain and trouble breathing" | "chest hurts, sweating" | "heart racing"',
      'Respiratory Scenario': 'Examples: "trouble breathing" | "can\'t breathe well, wheezing" | "shortness of breath"',
      'Neurologic Scenario': 'Examples: "sudden weakness on one side" | "confusion, slurred speech" | "bad headache"',
      'Metabolic Scenario': 'Examples: "confusion and dizzy" | "diabetic emergency, passed out" | "weak and nauseous"',
      'Abdominal Scenario': 'Examples: "severe stomach pain" | "vomiting blood" | "stomach hurts and nauseous"',
      'Environmental Scenario': 'Examples: "trouble breathing after bee sting" | "heat exhaustion, dizzy" | "allergic reaction"',
      'OB/GYN Scenario': 'Examples: "pregnant woman, contractions" | "heavy bleeding" | "pregnancy problems"'
    };
    return examples[scenarioType] || 'Examples: "medical symptoms or illness"';
  }

  /**
   * Parse the AI's template response
   * @param {string} response - AI response to parse
   * @returns {Object} - Parsed result with error flag and data
   */
  parseTemplateResponse(response) {
    try {
      // Handle null, undefined, or empty input
      if (!response || typeof response !== 'string') {
        return {
          error: true,
          message: 'Invalid template response',
          data: null
        };
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

      // Fix common JSON formatting issues
      cleanResponse = cleanResponse
        // Remove comments
        .replace(/\/\/[^\n\r]*/g, '')  // Remove // comments
        .replace(/\/\*[\s\S]*?\*\//g, '')  // Remove /* */ comments
        // Fix smart quotes and other characters
        .replace(/[""]/g, '"')  // Replace smart quotes with regular quotes
        .replace(/['']/g, "'")  // Replace smart single quotes with regular single quotes
        // Convert single-quoted property names to double-quoted
        .replace(/'([^']+)':/g, '"$1":')  // Convert 'property': to "property":
        .replace(/…/g, '...')   // Replace ellipsis with three dots
        // Handle trailing commas more comprehensively
        .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas before } or ]
        .replace(/,(\s*\n\s*[}\]])/g, '$1')  // Remove trailing commas before } or ] on new lines
        .replace(/,\s*}/g, '}')  // Remove trailing commas before closing brace
        .replace(/,\s*]/g, ']')  // Remove trailing commas before closing bracket
        // Clean up whitespace
        .replace(/\s+/g, ' ')   // Normalize whitespace
        .trim();

      const parsedData = JSON.parse(cleanResponse);
      
      // Parsing success; field-level validation happens later
      return {
        error: false,
        message: 'Template parsed successfully',
        data: parsedData
      };

    } catch (error) {
      console.error('❌ Failed to parse template response:', error);
      return {
        error: true,
        message: 'Failed to parse template response',
        data: null
      };
    }
  }

  /**
   * Check if time format is valid
   * @param {string} time - Time string to validate
   * @returns {boolean} - True if valid format
   */
  isValidTimeFormat(time) {
    if (!time || typeof time !== 'string') return false;
    
    // Reject generic terms
    const genericTerms = ['morning', 'afternoon', 'evening', 'night', 'today', 'now'];
    if (genericTerms.some(term => time.toLowerCase().includes(term))) {
      return false;
    }
    
    // Reject placeholders
    if (time.includes('<') || time.includes('>')) {
      return false;
    }
    
    // Accept format like "3:20pm" (lowercase, no space)
    const timeRegex = /^(1[0-2]|[1-9]):[0-5][0-9](am|pm)$/;
    return timeRegex.test(time);
  }

  /**
   * Check if mechanism is too generic
   * @param {string} mechanism - Mechanism string to validate
   * @returns {boolean} - True if too generic
   */
  isGenericMechanism(mechanism) {
    if (!mechanism || typeof mechanism !== 'string') return true;
    
    const genericTerms = [
      'medical emergency',
      'requiring medical attention',
      'needs help',
      'medical condition',
      'health issue',
      'medical problem'
    ];
    
    return genericTerms.some(term => 
      mechanism.toLowerCase().includes(term.toLowerCase())
    );
  }

  /**
   * Generate realistic patient demographics based on scenario type
   * @param {string} scenarioType - Type of scenario
   * @returns {Object} - Object with age and gender
   */
  generatePatientDemographics(scenarioType) {
    const scenarioTypeLower = scenarioType.toLowerCase();
    
    // Generate age based on scenario type
    let age;
    if (scenarioTypeLower.includes('cardiac') || scenarioTypeLower.includes('heart')) {
      const cardiacAges = [45, 52, 58, 63, 67, 71, 76];
      age = cardiacAges[Math.floor(Math.random() * cardiacAges.length)];
    } else if (scenarioTypeLower.includes('trauma') || scenarioTypeLower.includes('mvc') || 
               scenarioTypeLower.includes('fall') || scenarioTypeLower.includes('assault') ||
               scenarioTypeLower.includes('sport') || scenarioTypeLower.includes('stabbing') ||
               scenarioTypeLower.includes('gsw') || scenarioTypeLower.includes('burn')) {
      const traumaAges = [19, 25, 32, 28, 41, 35, 29, 47];
      age = traumaAges[Math.floor(Math.random() * traumaAges.length)];
    } else if (scenarioTypeLower.includes('respiratory') || scenarioTypeLower.includes('breathing') || 
               scenarioTypeLower.includes('asthma')) {
      const respiratoryAges = [28, 34, 41, 48, 55, 62, 37];
      age = respiratoryAges[Math.floor(Math.random() * respiratoryAges.length)];
    } else if (scenarioTypeLower.includes('neurological') || scenarioTypeLower.includes('stroke') || 
               scenarioTypeLower.includes('seizure')) {
      const neuroAges = [52, 59, 66, 73, 45, 38, 61];
      age = neuroAges[Math.floor(Math.random() * neuroAges.length)];
    } else if (scenarioTypeLower.includes('metabolic') || scenarioTypeLower.includes('diabetes') || 
               scenarioTypeLower.includes('hypoglycemic')) {
      const metabolicAges = [26, 33, 40, 47, 54, 61, 35];
      age = metabolicAges[Math.floor(Math.random() * metabolicAges.length)];
    } else if (scenarioTypeLower.includes('ob') || scenarioTypeLower.includes('gyn') || 
               scenarioTypeLower.includes('pregnant')) {
      const obAges = [18, 22, 25, 28, 31, 34, 37, 40];
      age = obAges[Math.floor(Math.random() * obAges.length)];
    } else {
      // General scenario ages
      const generalAges = [23, 31, 38, 44, 51, 59, 66, 29, 42, 56];
      age = generalAges[Math.floor(Math.random() * generalAges.length)];
    }
    
    // Generate gender (50/50 distribution, except OB/GYN which is always female)
    let gender;
    if (scenarioTypeLower.includes('ob') || scenarioTypeLower.includes('gyn') || 
        scenarioTypeLower.includes('pregnant')) {
      gender = 'female';
    } else {
      gender = Math.random() < 0.5 ? 'male' : 'female';
    }
    
    return { age: age.toString(), gender };
  }

  /**
   * Generate complete scenario using template-based approach
   * @param {Object} scenarioData - Input scenario data
   * @returns {Object} - Generated scenario with dispatch info
   */
  async generateCompleteScenario(scenarioData) {
    try {
      console.log('🚀 Generating template-based dispatch information...');
      
      // Check if OpenAI is available
      if (!this.openai) {
        console.log('❌ OpenAI not available, returning error');
        return {
          error: true,
          message: 'OpenAI service not available',
          dispatchInfo: null
        };
      }
      
      const template = this.generateCompleteDispatchTemplate(scenarioData.subScenario);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert EMT scenario generator. Generate realistic dispatch information for emergency scenarios.'
          },
          {
            role: 'user',
            content: template
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      const aiResponse = response.choices[0].message.content;
      console.log('✅ Template response received');
      
      const parsedResult = this.parseTemplateResponse(aiResponse);
      
      if (parsedResult.error) {
        console.log('❌ Template parsing failed:', parsedResult.message);
        return {
          error: true,
          message: 'Failed to generate dispatch information',
          dispatchInfo: null
        };
      }

      console.log('✅ Template parsing successful');
      
      // Enhanced validation with detailed feedback
      const validation = this.validateDispatchData(parsedResult.data, scenarioData.subScenario);
      // Enforce minimum quality score 80
      if (validation.score < 80) {
        return {
          error: true,
          message: 'Below quality threshold',
          dispatchInfo: null
        };
      }
      
      if (!validation.isValid) {
        console.log('⚠️ Dispatch validation failed:');
        validation.errors.forEach(error => console.log(`  ❌ ${error}`));
        validation.suggestions.forEach(suggestion => console.log(`  💡 ${suggestion}`));
        console.log(`📊 Quality score: ${validation.score}/100`);
        
        // Use fallback if validation fails
        console.log('❌ Validation below threshold; will signal error to caller for retry');
        return {
          error: true,
          message: 'Validation failed',
          dispatchInfo: null
        };
      } else {
        console.log('✅ Dispatch validation passed');
        if (validation.suggestions.length > 0) {
          console.log('💡 Suggestions for improvement:');
          validation.suggestions.forEach(suggestion => console.log(`  - ${suggestion}`));
        }
        console.log(`📊 Quality score: ${validation.score}/100`);
      }
      
      // Use demographics from dispatch when available to keep scenario consistent
      // Fallback to generated demographics only if missing/invalid
      let age = parsedResult.data?.age;
      let gender = parsedResult.data?.gender;
      
      const isValidGender = (g) => typeof g === 'string' && ['male', 'female'].includes(g.toLowerCase());
      const hasValidAge = (a) => a !== undefined && a !== null && !isNaN(parseInt(String(a)));
      
      if (!hasValidAge(age) || !isValidGender(gender)) {
        const generated = this.generatePatientDemographics(scenarioData.subScenario);
        age = hasValidAge(age) ? String(age) : generated.age;
        gender = isValidGender(gender) ? gender : generated.gender;
      } else {
        age = String(age);
        gender = gender.toLowerCase();
      }

      // Return the dispatch information in the expected format
      return {
        error: false,
        message: 'Scenario generated successfully',
        dispatchInfo: parsedResult.data,
        validation: validation,
        // Include other scenario data for compatibility
        patientProfile: {
          age: age,
          gender: gender,
          medicalHistory: ['Unknown'],
          medications: ['None known'],
          allergies: ['NKDA']
        },
        presentation: {
          chiefComplaint: parsedResult.data.symptoms || parsedResult.data.mechanism,
          onsetTime: 'recent',
          severity: 'moderate',
          location: 'various',
          description: `Patient presenting with ${parsedResult.data.symptoms || parsedResult.data.mechanism}`
        }
      };

    } catch (error) {
      console.error('❌ Failed to generate template-based scenario:', error);
      return {
        error: true,
        message: 'Failed to generate scenario',
        dispatchInfo: null
      };
    }
  }
}

module.exports = TemplateGenerator;
