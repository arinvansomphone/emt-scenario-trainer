// services/environmentalManager.js

class EnvironmentalManager {
  constructor() {
    this.weatherConditions = this.initializeWeatherConditions();
    this.sceneHazards = this.initializeSceneHazards();
    this.currentEnvironment = null;
  }

  /**
   * Initialize weather condition types and their effects
   * @returns {Object} - Weather conditions configuration
   */
  initializeWeatherConditions() {
    return {
      rain: {
        description: 'Light rain is falling',
        effects: ['slippery surfaces', 'equipment getting wet', 'patient getting cold'],
        probability: 0.15,
        severity: 'mild'
      },
      
      heavyRain: {
        description: 'Heavy rain is pouring down',
        effects: ['very slippery surfaces', 'poor visibility', 'equipment protection needed', 'patient hypothermia risk'],
        probability: 0.08,
        severity: 'moderate'
      },
      
      snow: {
        description: 'Snow is falling',
        effects: ['icy conditions', 'cold exposure', 'difficult footing', 'equipment challenges'],
        probability: 0.10,
        severity: 'moderate'
      },
      
      heat: {
        description: 'Extremely hot weather (95°F+)',
        effects: ['heat exhaustion risk', 'dehydration concerns', 'equipment overheating'],
        probability: 0.12,
        severity: 'mild'
      },
      
      wind: {
        description: 'Strong winds are blowing',
        effects: ['debris hazard', 'communication difficulties', 'equipment stability issues'],
        probability: 0.10,
        severity: 'mild'
      },
      
      fog: {
        description: 'Dense fog reducing visibility',
        effects: ['poor visibility', 'navigation challenges', 'additional vehicles may not see scene'],
        probability: 0.08,
        severity: 'moderate'
      }
    };
  }

  /**
   * Initialize scene safety hazards and their characteristics
   * @returns {Object} - Scene hazards configuration
   */
  initializeSceneHazards() {
    return {
      traffic: {
        description: 'Heavy traffic near the scene',
        effects: ['vehicle strike risk', 'noise interference', 'access difficulties'],
        locations: ['highway', 'road', 'street', 'intersection'],
        probability: 0.25,
        severity: 'high'
      },
      
      unstableStructure: {
        description: 'Potentially unstable building/structure',
        effects: ['collapse risk', 'debris hazard', 'evacuation may be needed'],
        locations: ['construction', 'old building', 'industrial'],
        probability: 0.12,
        severity: 'high'
      },
      
      electricalHazard: {
        description: 'Downed power lines nearby',
        effects: ['electrocution risk', 'area isolation needed', 'utility company required'],
        locations: ['residential', 'industrial', 'storm area'],
        probability: 0.10,
        severity: 'high'
      },
      
      chemicalSpill: {
        description: 'Unknown chemical spill in area',
        effects: ['contamination risk', 'respiratory protection needed', 'hazmat team required'],
        locations: ['industrial', 'highway', 'laboratory'],
        probability: 0.08,
        severity: 'high'
      },
      
      aggressiveBystanders: {
        description: 'Hostile or agitated crowd gathering',
        effects: ['personal safety risk', 'scene control needed', 'police backup required'],
        locations: ['public', 'bar', 'event', 'protest'],
        probability: 0.15,
        severity: 'moderate'
      },
      
      animalHazard: {
        description: 'Aggressive dog or other animal present',
        effects: ['bite risk', 'patient access limited', 'animal control needed'],
        locations: ['residential', 'rural', 'park'],
        probability: 0.12,
        severity: 'moderate'
      },
      
      fireHazard: {
        description: 'Smoke or fire visible in area',
        effects: ['evacuation risk', 'respiratory hazard', 'fire department coordination'],
        locations: ['residential', 'industrial', 'vehicle'],
        probability: 0.10,
        severity: 'high'
      },
      
      darkness: {
        description: 'Poor lighting conditions',
        effects: ['visibility issues', 'trip hazards', 'additional lighting needed'],
        locations: ['any'],
        probability: 0.20,
        severity: 'mild'
      }
    };
  }

  /**
   * Generate environmental factors for a scenario
   * @param {Object} scenarioData - Current scenario data
   * @returns {Object|null} - Environmental conditions or null if none
   */
  generateEnvironmentalFactors(scenarioData) {
    const difficulty = scenarioData?.generatedScenario?.difficulty?.level || 'intermediate';
    const location = scenarioData?.generatedScenario?.dispatchInfo?.location?.toLowerCase() || '';
    const time = scenarioData?.generatedScenario?.dispatchInfo?.time || '';
    
    // Environmental factors should be uncommon (as per requirements)
    const shouldHaveEnvironmental = Math.random() < 0.25; // 25% chance
    
    if (!shouldHaveEnvironmental) {
      this.currentEnvironment = null;
      return null;
    }

    // Determine if weather or scene hazard (or both)
    const hasWeather = Math.random() < 0.6; // 60% chance if environmental factors present
    const hasHazard = Math.random() < 0.4;  // 40% chance if environmental factors present
    
    this.currentEnvironment = {
      weather: hasWeather ? this.selectWeatherCondition(location, time) : null,
      sceneHazard: hasHazard ? this.selectSceneHazard(location, difficulty) : null,
      timestamp: Date.now()
    };

    console.log('🌦️ Environmental factors generated:', this.currentEnvironment);
    return this.currentEnvironment;
  }

  /**
   * Select appropriate weather condition based on context
   * @param {string} location - Scene location
   * @param {string} time - Time of day
   * @returns {Object|null} - Selected weather condition
   */
  selectWeatherCondition(location, time) {
    const availableWeather = Object.entries(this.weatherConditions);
    
    // Filter based on probability and context
    const suitableWeather = availableWeather.filter(([key, weather]) => {
      // Night time increases chance of fog and reduces heat
      if (/(pm|evening|night)/.test(time.toLowerCase()) && key === 'heat') {
        return false;
      }
      
      // Outdoor locations more affected by weather
      const isOutdoor = /(highway|road|park|trail|construction|rural)/.test(location);
      if (!isOutdoor && ['heavyRain', 'snow', 'wind'].includes(key)) {
        return Math.random() < 0.3; // Reduced chance for indoor-adjacent scenes
      }
      
      return Math.random() < weather.probability;
    });

    if (suitableWeather.length === 0) {
      return null;
    }

    const [selectedKey, selectedWeather] = suitableWeather[Math.floor(Math.random() * suitableWeather.length)];
    
    return {
      type: selectedKey,
      ...selectedWeather
    };
  }

  /**
   * Select appropriate scene hazard based on location and difficulty
   * @param {string} location - Scene location
   * @param {string} difficulty - Scenario difficulty
   * @returns {Object|null} - Selected scene hazard
   */
  selectSceneHazard(location, difficulty) {
    const availableHazards = Object.entries(this.sceneHazards);
    
    // Filter hazards appropriate for location
    const suitableHazards = availableHazards.filter(([key, hazard]) => {
      // Check location compatibility
      if (hazard.locations && !hazard.locations.includes('any')) {
        const locationMatch = hazard.locations.some(loc => location.includes(loc));
        if (!locationMatch) {
          return false;
        }
      }
      
      // Difficulty affects probability of high-severity hazards
      if (hazard.severity === 'high' && difficulty === 'novice') {
        return Math.random() < 0.3; // Reduced chance for novice
      }
      
      if (hazard.severity === 'mild' && difficulty === 'advanced') {
        return Math.random() < 0.7; // Reduced chance for advanced (they get harder hazards)
      }
      
      return Math.random() < hazard.probability;
    });

    if (suitableHazards.length === 0) {
      return null;
    }

    const [selectedKey, selectedHazard] = suitableHazards[Math.floor(Math.random() * suitableHazards.length)];
    
    return {
      type: selectedKey,
      ...selectedHazard
    };
  }

  /**
   * Get environmental context for AI responses
   * @returns {string|null} - Environmental context string
   */
  getEnvironmentalContext() {
    if (!this.currentEnvironment) {
      return null;
    }

    const contexts = [];
    
    if (this.currentEnvironment.weather) {
      const weather = this.currentEnvironment.weather;
      contexts.push(`Weather: ${weather.description}. Effects: ${weather.effects.join(', ')}.`);
    }
    
    if (this.currentEnvironment.sceneHazard) {
      const hazard = this.currentEnvironment.sceneHazard;
      contexts.push(`Scene hazard: ${hazard.description}. Safety concerns: ${hazard.effects.join(', ')}.`);
    }

    return contexts.length > 0 ? contexts.join(' ') : null;
  }

  /**
   * Check if environmental factors affect specific EMT actions
   * @param {string} emtAction - Action being performed by EMT
   * @returns {string|null} - Environmental impact description
   */
  checkEnvironmentalImpact(emtAction) {
    if (!this.currentEnvironment) {
      return null;
    }

    const normalizedAction = emtAction.toLowerCase();
    const impacts = [];

    // Weather impacts
    if (this.currentEnvironment.weather) {
      const weather = this.currentEnvironment.weather;
      
      if (/(equipment|grab|get|use)/.test(normalizedAction)) {
        if (weather.type === 'rain' || weather.type === 'heavyRain') {
          impacts.push('Your equipment is getting wet from the rain.');
        }
        if (weather.type === 'wind') {
          impacts.push('Strong winds are making it difficult to handle equipment.');
        }
      }
      
      if (/(walk|move|position|transport)/.test(normalizedAction)) {
        if (weather.type === 'rain' || weather.type === 'heavyRain' || weather.type === 'snow') {
          impacts.push('The ground is slippery, requiring extra caution while moving.');
        }
        if (weather.type === 'fog') {
          impacts.push('Dense fog is reducing visibility significantly.');
        }
      }
      
      if (/(patient|assess|examine)/.test(normalizedAction)) {
        if (weather.type === 'heat') {
          impacts.push('The extreme heat is affecting both you and the patient.');
        }
        if (weather.type === 'snow' || weather.type === 'rain') {
          impacts.push('The patient is being exposed to harsh weather conditions.');
        }
      }
    }

    // Scene hazard impacts
    if (this.currentEnvironment.sceneHazard) {
      const hazard = this.currentEnvironment.sceneHazard;
      
      if (/(approach|move|position)/.test(normalizedAction)) {
        if (hazard.type === 'traffic') {
          impacts.push('Heavy traffic is creating safety concerns as you work.');
        }
        if (hazard.type === 'electricalHazard') {
          impacts.push('You must maintain safe distance from the downed power lines.');
        }
        if (hazard.type === 'unstableStructure') {
          impacts.push('The unstable structure overhead is a constant threat.');
        }
      }
      
      if (/(communicate|talk|ask)/.test(normalizedAction)) {
        if (hazard.type === 'traffic') {
          impacts.push('Traffic noise is making communication difficult.');
        }
        if (hazard.type === 'aggressiveBystanders') {
          impacts.push('The hostile crowd is creating a tense atmosphere.');
        }
      }
      
      if (/(assess|examine|treat)/.test(normalizedAction)) {
        if (hazard.type === 'darkness') {
          impacts.push('Poor lighting is making assessment more challenging.');
        }
        if (hazard.type === 'chemicalSpill') {
          impacts.push('Potential chemical contamination is limiting your access to the patient.');
        }
      }
    }

    return impacts.length > 0 ? impacts.join(' ') : null;
  }

  /**
   * Generate safety recommendations based on current environment
   * @returns {Array} - List of safety recommendations
   */
  getSafetyRecommendations() {
    if (!this.currentEnvironment) {
      return [];
    }

    const recommendations = [];

    if (this.currentEnvironment.weather) {
      const weather = this.currentEnvironment.weather;
      
      switch (weather.type) {
        case 'rain':
        case 'heavyRain':
          recommendations.push('Consider protecting patient and equipment from rain');
          recommendations.push('Use extra caution on slippery surfaces');
          break;
        case 'snow':
          recommendations.push('Watch for icy conditions');
          recommendations.push('Protect patient from cold exposure');
          break;
        case 'heat':
          recommendations.push('Monitor for heat-related complications');
          recommendations.push('Ensure adequate hydration');
          break;
        case 'wind':
          recommendations.push('Secure loose equipment');
          recommendations.push('Be aware of flying debris');
          break;
        case 'fog':
          recommendations.push('Use additional lighting if available');
          recommendations.push('Ensure scene visibility for other responders');
          break;
      }
    }

    if (this.currentEnvironment.sceneHazard) {
      const hazard = this.currentEnvironment.sceneHazard;
      
      switch (hazard.type) {
        case 'traffic':
          recommendations.push('Request traffic control');
          recommendations.push('Position ambulance to protect scene');
          break;
        case 'electricalHazard':
          recommendations.push('Contact utility company immediately');
          recommendations.push('Maintain safe distance from power lines');
          break;
        case 'unstableStructure':
          recommendations.push('Consider scene evacuation');
          recommendations.push('Request structural assessment');
          break;
        case 'chemicalSpill':
          recommendations.push('Request hazmat team');
          recommendations.push('Use appropriate PPE');
          break;
        case 'aggressiveBystanders':
          recommendations.push('Request police backup');
          recommendations.push('Maintain situational awareness');
          break;
        case 'animalHazard':
          recommendations.push('Contact animal control');
          recommendations.push('Ensure safe patient access');
          break;
        case 'fireHazard':
          recommendations.push('Coordinate with fire department');
          recommendations.push('Be prepared for evacuation');
          break;
        case 'darkness':
          recommendations.push('Set up additional lighting');
          recommendations.push('Watch for trip hazards');
          break;
      }
    }

    return recommendations;
  }

  /**
   * Reset environmental manager for new scenario
   */
  reset() {
    this.currentEnvironment = null;
    console.log('🌦️ Environmental manager reset');
  }

  /**
   * Get current environmental status
   * @returns {Object|null} - Current environment status
   */
  getCurrentEnvironment() {
    return this.currentEnvironment;
  }

  /**
   * Check if environment requires immediate action
   * @returns {Object|null} - Urgent environmental concern
   */
  checkUrgentEnvironmentalConcerns() {
    if (!this.currentEnvironment) {
      return null;
    }

    const urgentConcerns = [];

    if (this.currentEnvironment.sceneHazard) {
      const hazard = this.currentEnvironment.sceneHazard;
      
      if (hazard.severity === 'high') {
        urgentConcerns.push({
          type: 'sceneHazard',
          description: hazard.description,
          action: 'Immediate safety assessment required',
          effects: hazard.effects
        });
      }
    }

    if (this.currentEnvironment.weather) {
      const weather = this.currentEnvironment.weather;
      
      if (weather.severity === 'moderate' && weather.type === 'heavyRain') {
        urgentConcerns.push({
          type: 'weather',
          description: weather.description,
          action: 'Patient protection from elements needed',
          effects: weather.effects
        });
      }
    }

    return urgentConcerns.length > 0 ? urgentConcerns : null;
  }

  /**
   * Generate environmental factor for current scenario
   * @returns {string|null} - Environmental factor description
   */
  generateFactor() {
    // Only generate environmental factors occasionally (20% chance)
    if (Math.random() > 0.2) {
      return null;
    }

    if (!this.currentEnvironment) {
      return null;
    }

    const factors = [];

    if (this.currentEnvironment.weather) {
      const weather = this.currentEnvironment.weather;
      factors.push(`Weather: ${weather.description}`);
    }

    if (this.currentEnvironment.sceneHazard) {
      const hazard = this.currentEnvironment.sceneHazard;
      factors.push(`Scene hazard: ${hazard.description}`);
    }

    return factors.length > 0 ? factors[Math.floor(Math.random() * factors.length)] : null;
  }

  /**
   * Reset environmental manager for new scenario
   */
  reset() {
    this.currentEnvironment = null;
    console.log('🌤️ Environmental manager reset');
  }
}

module.exports = EnvironmentalManager;
