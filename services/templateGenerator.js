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
    return `Generate dispatch information for a ${scenarioType}. Fill in this template with realistic details:

{
  "location": "[specific location where incident occurred - be specific like 'shopping mall food court', 'hiking trail near Pine Ridge Park', 'residential home on Oak Street']",
  "time": "[time in format like '2:30 PM', '10:45 AM', '4:15 PM' - NOT 'afternoon', 'morning', or '<current time>']",
  "callerInfo": "[who called 911 - be specific like 'bystander who noticed patient clutching chest', 'family member', 'co-worker']",
  "mechanism": "[specific symptoms or mechanism - be specific like 'chest pain and shortness of breath', 'fell from ladder complaining of back pain', 'difficulty breathing after bee sting' - NOT 'medical emergency' or 'requiring medical attention']"
}

CRITICAL REQUIREMENTS:
- Time must be in specific format (e.g., "2:30 PM") - no placeholders
- Mechanism must be specific symptoms or observable conditions
- Location must be a specific place, not generic
- All fields are required

Return ONLY the JSON object, no additional text or comments.`;
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
      
      // Validate required fields
      const requiredFields = ['location', 'time', 'callerInfo', 'mechanism'];
      const missingFields = requiredFields.filter(field => !parsedData[field]);
      
      if (missingFields.length > 0) {
        return {
          error: true,
          message: 'Missing required fields in template response',
          data: null
        };
      }

      // Validate time format
      const timeValue = parsedData.time;
      if (!this.isValidTimeFormat(timeValue)) {
        return {
          error: true,
          message: 'Invalid time format',
          data: null
        };
      }

      // Validate mechanism is not too generic
      if (this.isGenericMechanism(parsedData.mechanism)) {
        return {
          error: true,
          message: 'Mechanism is too generic',
          data: null
        };
      }

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
    
    // Accept formats like "2:30 PM", "10:45 AM", "4:15 PM"
    const timeRegex = /^\d{1,2}:\d{2}\s*(AM|PM)$/i;
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
      
      const template = this.generateDispatchTemplate(scenarioData.subScenario);
      
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
      
      // Return the dispatch information in the expected format
      return {
        error: false,
        message: 'Scenario generated successfully',
        dispatchInfo: parsedResult.data,
        // Include other scenario data for compatibility
        patientProfile: {
          age: 'unknown',
          gender: 'unknown',
          medicalHistory: ['Unknown'],
          medications: ['None known'],
          allergies: ['NKDA']
        },
        presentation: {
          chiefComplaint: parsedResult.data.mechanism,
          onsetTime: 'recent',
          severity: 'moderate',
          location: 'various',
          description: `Patient presenting with ${parsedResult.data.mechanism}`
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
