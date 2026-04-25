const TextNormalizer = require('../utils/textNormalizer');

class VitalsProcessor {
  detectVitalsRequest(message) {
    const normalizedMessage = TextNormalizer.normalizeToAsciiLower(message);

    // Qualitative skin temp check (no thermometer) — suppress numeric temperature vital
    const isSkinTempQualitative = !/(thermometer|temp(erature)?\s*reading|take.*temp)/.test(normalizedMessage) && (
      /(skin|forehead|wrist|hand|arm).*(temp(erature)?|warm|cool|hot|cold)/.test(normalizedMessage) ||
      /(temp(erature)?|warm|cool|hot|cold).*(skin|forehead|wrist|hand|arm)/.test(normalizedMessage) ||
      /feel.*(forehead|skin)/.test(normalizedMessage)
    );

    // Detect when the user is REPORTING a known value to the patient rather than REQUESTING a reading.
    // e.g. "your oxygen sat is 94%, we're going to give you oxygen" — not a vitals check request.
    const isReportingValue = /(is|was|reads?|shows?|came? back|result)\s+\d+/.test(normalizedMessage) ||
      /\d+\s*%\s*(which|so|that)/.test(normalizedMessage) ||
      /your (heart rate|pulse|bp|blood pressure|oxygen|sat|spo2|o2|temp|temperature) is \d+/.test(normalizedMessage);

    // Check for specific vitals mentioned — suppress if the user is just informing the patient
    const specificVitals = {
      isPulseOx: !isReportingValue && /(pulse ox|oxygen saturation|saturation|spo2|sp02|finger probe|pulse oximeter|oximeter)/.test(normalizedMessage),
      isHeartRate: !isReportingValue && /(heart rate|pulse|hr)\b/.test(normalizedMessage),
      isRespRate: !isReportingValue && /(respiratory rate|respiration rate|breathing rate|rr)\b/.test(normalizedMessage),
      isBloodPressure: !isReportingValue && /(blood pressure|bp)\b/.test(normalizedMessage),
      isTemperature: !isSkinTempQualitative && !isReportingValue && /(temp|temperature)\b/.test(normalizedMessage),
      isBloodGlucose: !isReportingValue && /(blood glucose|blood sugar|bgl|glucometry|glucometer|glucose level|sugar level)/.test(normalizedMessage)
    };
    
    // Check if any specific vitals are mentioned
    const hasSpecificVitals = Object.values(specificVitals).some(v => v);
    
    // Check if it's a general vitals request without specifics
    const isGeneralVitalsRequest = /(full set|all vitals|complete set|vital signs|vitals)\b/.test(normalizedMessage) && !hasSpecificVitals;
    
    // Only need specification if it's a general request with no specific vitals mentioned
    const needsSpecification = isGeneralVitalsRequest;
    
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
    const [bpSystolic, bpDiastolic] = (parsedVitals.bp || '').split('/');

    if (request.isFullVitals) {
      return [
        `Heart rate is ${parsedVitals.hr} beats per minute.`,
        `Respiratory rate is ${parsedVitals.rr} breaths per minute.`,
        `Blood pressure is ${bpSystolic} over ${bpDiastolic}.`,
        `Oxygen saturation is ${parsedVitals.spo2} percent.`,
        `Temperature is ${parsedVitals.temp} degrees Fahrenheit.`
      ].join('\n');
    }

    const vitals = [];
    if (request.isPulseOx) vitals.push(`Oxygen saturation is ${parsedVitals.spo2} percent.`);
    if (request.isHeartRate) vitals.push(`Heart rate is ${parsedVitals.hr} beats per minute.`);
    if (request.isRespRate) vitals.push(`Respiratory rate is ${parsedVitals.rr} breaths per minute.`);
    if (request.isBloodPressure) vitals.push(`Blood pressure is ${bpSystolic} over ${bpDiastolic}.`);
    if (request.isTemperature) vitals.push(`Temperature is ${parsedVitals.temp} degrees Fahrenheit.`);
    
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
