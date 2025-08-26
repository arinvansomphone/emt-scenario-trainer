// services/performanceEvaluator.js

class PerformanceEvaluator {
  constructor() {
    this.evaluationCriteria = this.initializeEvaluationCriteria();
    this.scenarioLog = [];
    this.performanceMetrics = {};
  }

  initializeEvaluationCriteria() {
    return {
      sceneAssessment: { weight: 15, maxPoints: 15 },
      primaryAssessment: { weight: 20, maxPoints: 20 },
      vitalSigns: { weight: 10, maxPoints: 10 },
      secondaryAssessment: { weight: 15, maxPoints: 15 },
      interventions: { weight: 25, maxPoints: 25 },
      communication: { weight: 10, maxPoints: 10 },
      transportDecision: { weight: 5, maxPoints: 5 }
    };
  }

  startEvaluation(scenarioData, startTime) {
    this.performanceMetrics = {
      scenarioId: `scenario_${Date.now()}`,
      startTime: startTime,
      endTime: null,
      scenarioType: scenarioData?.mainScenario || 'Unknown',
      difficulty: scenarioData?.generatedScenario?.difficulty?.level || 'intermediate',
      totalTime: 0,
      actions: [],
      vitalsChecked: [],
      interventionsPerformed: [],
      communicationEvents: [],
      errors: [],
      scores: {}
    };
    console.log('📊 Performance evaluation started');
  }

  logAction(action, timestamp, details = {}) {
    const actionLog = {
      action,
      timestamp,
      elapsedTime: timestamp - this.performanceMetrics.startTime,
      details,
      category: this.categorizeAction(action)
    };

    this.performanceMetrics.actions.push(actionLog);

    if (details.actionType === 'vitalCheck') {
      this.performanceMetrics.vitalsChecked.push({
        vitalType: details.vitalType,
        timestamp,
        elapsedTime: actionLog.elapsedTime
      });
    }

    if (details.actionType === 'medicationAdmin' || details.actionType === 'equipmentUse') {
      this.performanceMetrics.interventionsPerformed.push({
        intervention: action,
        timestamp,
        elapsedTime: actionLog.elapsedTime,
        details
      });
    }
  }

  categorizeAction(action) {
    const normalized = action.toLowerCase();
    
    if (/(scene|safety|bsi|ppe)/.test(normalized)) return 'sceneAssessment';
    if (/(airway|breathing|circulation|mental|primary)/.test(normalized)) return 'primaryAssessment';
    if (/(vital|pulse|bp|heart rate|respiratory rate|temperature|oxygen sat)/.test(normalized)) return 'vitalSigns';
    if (/(history|sample|opqrst|examine|inspect|palpate|secondary)/.test(normalized)) return 'secondaryAssessment';
    if (/(medication|oxygen|treatment|intervention|position)/.test(normalized)) return 'interventions';
    if (/(ask|question|talk|communicate)/.test(normalized)) return 'communication';
    if (/(transport|priority|code)/.test(normalized)) return 'transportDecision';
    
    return 'other';
  }

  endEvaluation(endTime, finalState) {
    this.performanceMetrics.endTime = endTime;
    this.performanceMetrics.totalTime = Math.floor((endTime - this.performanceMetrics.startTime) / 60000);

    // Calculate scores for each category
    Object.keys(this.evaluationCriteria).forEach(category => {
      this.performanceMetrics.scores[category] = this.calculateCategoryScore(category, finalState);
    });

    // Calculate overall score
    const totalPossible = Object.values(this.evaluationCriteria).reduce((sum, cat) => sum + cat.maxPoints, 0);
    const totalEarned = Object.values(this.performanceMetrics.scores).reduce((sum, score) => sum + score.points, 0);
    
    this.performanceMetrics.overallScore = {
      points: totalEarned,
      maxPoints: totalPossible,
      percentage: Math.round((totalEarned / totalPossible) * 100)
    };

    return this.generateEvaluationReport();
  }

  calculateCategoryScore(category, finalState) {
    const criteria = this.evaluationCriteria[category];
    const categoryActions = this.performanceMetrics.actions.filter(action => action.category === category);
    
    let points = 0;
    const feedback = [];
    const strengths = [];
    const improvements = [];

    switch (category) {
      case 'sceneAssessment':
        points = this.evaluateSceneAssessment(categoryActions, strengths, improvements);
        break;
      case 'primaryAssessment':
        points = this.evaluatePrimaryAssessment(categoryActions, strengths, improvements);
        break;
      case 'vitalSigns':
        points = this.evaluateVitalSigns(strengths, improvements);
        break;
      case 'interventions':
        points = this.evaluateInterventions(strengths, improvements);
        break;
      case 'communication':
        points = this.evaluateCommunication(strengths, improvements);
        break;
      case 'transportDecision':
        points = this.evaluateTransportDecision(categoryActions, strengths, improvements);
        break;
      default:
        points = Math.floor(criteria.maxPoints * 0.7); // Default partial credit
    }

    return {
      points: Math.min(points, criteria.maxPoints),
      maxPoints: criteria.maxPoints,
      percentage: Math.round((Math.min(points, criteria.maxPoints) / criteria.maxPoints) * 100),
      strengths,
      improvements
    };
  }

  evaluateSceneAssessment(actions, strengths, improvements) {
    let points = 0;
    
    if (actions.some(a => /(scene|safety)/.test(a.action.toLowerCase()))) {
      points += 8;
      strengths.push('Performed scene safety assessment');
    } else {
      improvements.push('Should assess scene safety before patient contact');
    }
    
    if (actions.some(a => /(mechanism|what happened|witness)/.test(a.action.toLowerCase()))) {
      points += 7;
      strengths.push('Gathered information about mechanism of injury');
    } else {
      improvements.push('Should gather information about what happened');
    }
    
    return points;
  }

  evaluateVitalSigns(strengths, improvements) {
    let points = 0;
    const vitalsChecked = this.performanceMetrics.vitalsChecked;
    
    if (vitalsChecked.some(v => v.vitalType === 'bloodPressure')) {
      points += 3;
      strengths.push('Measured blood pressure');
    } else {
      improvements.push('Should measure blood pressure');
    }
    
    if (vitalsChecked.some(v => v.vitalType === 'heartRate')) {
      points += 3;
      strengths.push('Checked pulse');
    } else {
      improvements.push('Should check pulse');
    }
    
    if (vitalsChecked.some(v => v.vitalType === 'oxygenSaturation')) {
      points += 4;
      strengths.push('Checked oxygen saturation');
    } else {
      improvements.push('Should check oxygen saturation');
    }
    
    return points;
  }

  evaluateInterventions(strengths, improvements) {
    let points = 0;
    const interventions = this.performanceMetrics.interventionsPerformed;
    
    if (interventions.length >= 2) {
      points += 15;
      strengths.push('Performed appropriate interventions');
    } else if (interventions.length >= 1) {
      points += 8;
      improvements.push('Consider additional interventions');
    } else {
      improvements.push('Should perform appropriate interventions');
    }
    
    // Award points for timely interventions
    const timelyInterventions = interventions.filter(i => i.elapsedTime < 600000);
    if (timelyInterventions.length >= interventions.length * 0.8) {
      points += 10;
      strengths.push('Performed interventions in timely manner');
    }
    
    return points;
  }

  evaluateCommunication(strengths, improvements) {
    let points = 0;
    const communications = this.performanceMetrics.communicationEvents;
    
    if (communications.length >= 3) {
      points += 10;
      strengths.push('Communicated effectively');
    } else if (communications.length >= 1) {
      points += 5;
      improvements.push('Should communicate more with patient');
    } else {
      improvements.push('Should explain procedures to patient');
    }
    
    return points;
  }

  evaluateTransportDecision(actions, strengths, improvements) {
    let points = 0;
    
    if (actions.length > 0) {
      points += 5;
      strengths.push('Made transport decision');
    } else {
      improvements.push('Should make transport decision');
    }
    
    return points;
  }

  generateEvaluationReport() {
    return {
      summary: {
        overallScore: this.performanceMetrics.overallScore,
        scenarioType: this.performanceMetrics.scenarioType,
        difficulty: this.performanceMetrics.difficulty,
        totalTime: this.performanceMetrics.totalTime
      },
      categoryScores: this.performanceMetrics.scores,
      strengths: this.getAllStrengths(),
      improvements: this.getAllImprovements(),
      detailedMetrics: {
        totalActions: this.performanceMetrics.actions.length,
        vitalsChecked: this.performanceMetrics.vitalsChecked.length,
        interventionsPerformed: this.performanceMetrics.interventionsPerformed.length
      }
    };
  }

  getAllStrengths() {
    const allStrengths = [];
    Object.values(this.performanceMetrics.scores).forEach(score => {
      if (score.strengths) allStrengths.push(...score.strengths);
    });
    return [...new Set(allStrengths)];
  }

  getAllImprovements() {
    const allImprovements = [];
    Object.values(this.performanceMetrics.scores).forEach(score => {
      if (score.improvements) allImprovements.push(...score.improvements);
    });
    return [...new Set(allImprovements)];
  }

  reset() {
    this.scenarioLog = [];
    this.performanceMetrics = {};
    console.log('📊 Performance evaluator reset');
  }
}

module.exports = PerformanceEvaluator;
