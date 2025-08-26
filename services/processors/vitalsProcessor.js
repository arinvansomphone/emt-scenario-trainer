const TextNormalizer = require('../utils/textNormalizer');

class VitalsProcessor {
  detectVitalsRequest(message) {
    const normalizedMessage = TextNormalizer.normalizeToAsciiLower(message);
    
    // Check if it's a general vitals request without specifics
    const isGeneralVitalsRequest = /full set|all vitals|complete set|vital signs/.test(normalizedMessage);
    
    // Check for specific vitals mentioned
    const specificVitals = {
      isPulseOx: /(pulse ox|oxygen saturation|saturation|spo2|sp02|finger probe|pulse oximeter|oximeter)/.test(normalizedMessage),
      isHeartRate: /heart rate|pulse|hr/.test(normalizedMessage),
      isRespRate: /respiratory rate|breathing rate|rr/.test(normalizedMessage),
      isBloodPressure: /blood pressure|bp/.test(normalizedMessage),
      isTemperature: /temp|temperature/.test(normalizedMessage)
    };
    
    // If it's a general request but no specific vitals are mentioned, we need specification
    const hasSpecificVitals = Object.values(specificVitals).some(v => v);
    const needsSpecification = isGeneralVitalsRequest && !hasSpecificVitals;
    
    return {
      ...specificVitals,
      needsSpecification
    };
  }

  parseVitals(vitalsString) {
    const match = vitalsString.match(/HR (\d+), RR (\d+), BP (\d+\/\d+), SpO2 (\d+)%, Temp ([\d.]+)°F/);
    if (!match) return null;

    const [_, hr, rr, bp, spo2, temp] = match;
    return { hr, rr, bp, spo2, temp };
  }

  async generatePatientResponse(scenarioData, vitalsRequested) {
    // Let the AI generate the response through the system prompt
    const result = `Current SpO2: ${spO2Value}%. Respond naturally as the patient to having vitals checked. Consider:
- Patient is ${scenarioData.generatedScenario.patientProfile.age}-year-old ${scenarioData.generatedScenario.patientProfile.gender}
- Chief complaint: ${scenarioData.generatedScenario.presentation.chiefComplaint}
- Current severity: ${scenarioData.generatedScenario.presentation.severity}
- Physical state: ${scenarioData.generatedScenario.physicalFindings.generalAppearance}
- Breathing: ${scenarioData.generatedScenario.physicalFindings.breathing}
- Specific vitals being checked: ${vitalsRequested.join(', ')}`;

    return result;
  }

  formatVitalsResponse(parsedVitals, request) {
    if (request.isFullVitals) {
      return [
        `HR: ${parsedVitals.hr}`,
        `RR: ${parsedVitals.rr}`,
        `BP: ${parsedVitals.bp}`,
        `SpO2: ${parsedVitals.spo2}%`,
        `Temp: ${parsedVitals.temp}°F`
      ].join('\n');
    }

    const vitals = [];
    if (request.isPulseOx) vitals.push(`SpO2: ${parsedVitals.spo2}%`);
    if (request.isHeartRate) vitals.push(`HR: ${parsedVitals.hr}`);
    if (request.isRespRate) vitals.push(`RR: ${parsedVitals.rr}`);
    if (request.isBloodPressure) vitals.push(`BP: ${parsedVitals.bp}`);
    if (request.isTemperature) vitals.push(`Temp: ${parsedVitals.temp}°F`);
    
    return vitals.join('\n');
  }

  processVitalsRequest(message, vitalsString, scenarioData) {
    const request = this.detectVitalsRequest(message);
    
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

    const parsedVitals = this.parseVitals(vitalsString);
    if (!parsedVitals) return null;

    const patientResponse = this.generatePatientResponse(scenarioData);
    const vitalsResponse = this.formatVitalsResponse(parsedVitals, request);

    return `${patientResponse}\n\n${vitalsResponse}\n\nAwaiting your next step.`;
  }
}

module.exports = VitalsProcessor;
