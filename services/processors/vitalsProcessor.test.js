const VitalsProcessor = require('./vitalsProcessor');

describe('VitalsProcessor', () => {
  let processor;
  const mockScenarioData = {
    generatedScenario: {
      presentation: {
        chiefComplaint: 'chest pain and shortness of breath'
      },
      physicalFindings: {
        generalAppearance: 'alert and cooperative, mild anxiety'
      }
    }
  };

  const mockVitals = 'HR 110, RR 20, BP 160/95, SpO2 95%, Temp 98.6°F';

  beforeEach(() => {
    processor = new VitalsProcessor();
  });

  describe('detectVitalsRequest', () => {
    test('detects unspecified vitals request', () => {
      const messages = [
        'take a full set of vitals',
        'check all vital signs',
        'get a complete set of vitals',
        'let me get your vitals'
      ];
      messages.forEach(msg => {
        expect(processor.detectVitalsRequest(msg).needsSpecification).toBe(true);
      });
    });

    test('detects individual vital requests', () => {
      const cases = [
        { msg: 'check pulse ox', expected: { isPulseOx: true } },
        { msg: 'what is your heart rate', expected: { isHeartRate: true } },
        { msg: 'let me check your blood pressure', expected: { isBloodPressure: true } },
        { msg: 'respiratory rate check', expected: { isRespRate: true } },
        { msg: 'temperature check', expected: { isTemperature: true } }
      ];
      cases.forEach(({ msg, expected }) => {
        const result = processor.detectVitalsRequest(msg);
        Object.entries(expected).forEach(([key, value]) => {
          expect(result[key]).toBe(value);
        });
      });
    });
  });

  describe('parseVitals', () => {
    test('parses all vitals correctly', () => {
      const result = processor.parseVitals(mockVitals);
      expect(result).toEqual({
        hr: '110',
        rr: '20',
        bp: '160/95',
        spo2: '95',
        temp: '98.6'
      });
    });

    test('returns null for invalid vitals string', () => {
      expect(processor.parseVitals('invalid')).toBeNull();
    });
  });

  describe('generatePatientResponse', () => {
    test('generates chest pain response', () => {
      const result = processor.generatePatientResponse(mockScenarioData);
      expect(result).toBe('"Yes, go ahead. My chest is still hurting though."');
    });

    test('generates anxiety response', () => {
      const anxiousScenario = {
        generatedScenario: {
          physicalFindings: {
            generalAppearance: 'mild anxiety'
          }
        }
      };
      const result = processor.generatePatientResponse(anxiousScenario);
      expect(result).toBe('"Sure, I hope everything looks okay."');
    });

    test('generates default response when no conditions match', () => {
      const basicScenario = {
        generatedScenario: {
          physicalFindings: {
            generalAppearance: 'alert'
          }
        }
      };
      const result = processor.generatePatientResponse(basicScenario);
      expect(result).toBe('"Okay, that\'s fine."');
    });
  });

  describe('formatVitalsResponse', () => {
    const parsedVitals = {
      hr: '110',
      rr: '20',
      bp: '160/95',
      spo2: '95',
      temp: '98.6'
    };

    test('formats full vitals response', () => {
      const request = { isFullVitals: true };
      const result = processor.formatVitalsResponse(parsedVitals, request);
      expect(result).toBe('HR: 110\nRR: 20\nBP: 160/95\nSpO2: 95%\nTemp: 98.6°F');
    });

    test('formats single vital response', () => {
      const request = { isPulseOx: true };
      const result = processor.formatVitalsResponse(parsedVitals, request);
      expect(result).toBe('SpO2: 95%');
    });

    test('formats multiple selected vitals', () => {
      const request = { isHeartRate: true, isBloodPressure: true };
      const result = processor.formatVitalsResponse(parsedVitals, request);
      expect(result).toBe('HR: 110\nBP: 160/95');
    });
  });

  describe('processVitalsRequest', () => {
    test('asks for specification when vitals not specified', () => {
      const result = processor.processVitalsRequest(
        'take a full set of vitals',
        mockVitals,
        mockScenarioData
      );
      expect(result).toBe(
        '"Which vitals would you like me to check?"'
      );
    });

    test('processes single vital request', () => {
      const result = processor.processVitalsRequest(
        'check pulse ox',
        mockVitals,
        mockScenarioData
      );
      expect(result).toBe(
        '"Yes, go ahead. My chest is still hurting though."\n\n' +
        'SpO2: 95%\n\n' +
        'Awaiting your next step.'
      );
    });

    test('returns null for non-vitals request', () => {
      const result = processor.processVitalsRequest(
        'how are you feeling',
        mockVitals,
        mockScenarioData
      );
      expect(result).toBeNull();
    });
  });
});
