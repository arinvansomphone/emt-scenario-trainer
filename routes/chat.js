// routes/chat.js
const express = require('express');
const ChatService = require('../services/chatService');
const GradingEngine = require('../services/gradingEngine');
const sessionManager = require('../services/sessionManager');
const ConversationSummarizer = require('../services/conversationSummarizer');
const examAssessmentManager = require('../services/examAssessmentManager');
const router = express.Router();
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openai } = require('../config/openai');

// Initialize summarizer
const conversationSummarizer = new ConversationSummarizer();

// Input validation middleware
const validateChatInput = (req, res, next) => {
  const { message, conversation } = req.body;

  // Check if message exists
  if (!message) {
    return res.status(400).json({
      success: false,
      error: 'Message is required'
    });
  }

  // Check message type
  if (typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Message must be a string'
    });
  }

  // Check message length
  if (message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Message cannot be empty'
    });
  }

  if (message.length > 4000) {
    return res.status(400).json({
      success: false,
      error: 'Message too long (max 4000 characters)'
    });
  }

  // Validate conversation if provided
  if (conversation && !Array.isArray(conversation)) {
    return res.status(400).json({
      success: false,
      error: 'Conversation must be an array'
    });
  }

  next();
};

// Main chat endpoint with session management
router.post('/chat', validateChatInput, async (req, res) => {
  try {
    const { message, conversation = [], scenarioData = null, seed = null, sessionId = null } = req.body;

    console.log(`Received message: ${message.substring(0, 100)}...`);
    
    // Handle session management
    let currentSessionId = sessionId;
    let sessionState = null;
    
    // If no sessionId provided or session doesn't exist, create new session
    if (!currentSessionId || !sessionManager.hasSession(currentSessionId)) {
      console.log('🆕 Creating new session...');
      currentSessionId = sessionManager.createSession({
        scenarioData: scenarioData,
        conversation: conversation,
        sunetId: scenarioData?.sunetId
      });
      sessionState = sessionManager.getSession(currentSessionId);
    } else {
      console.log(`📦 Using existing session: ${currentSessionId}`);
      sessionState = sessionManager.getSession(currentSessionId);
      
      // Update session with any new scenario data
      if (scenarioData) {
        sessionManager.updateSession(currentSessionId, { scenarioData });
        sessionState = sessionManager.getSession(currentSessionId);
      }
    }

    console.log('Scenario data:', sessionState.scenarioData);

    // Thread deterministic seed via scenarioData.meta.seed
    const scenarioWithMeta = sessionState.scenarioData || {};
    scenarioWithMeta.meta = Object.assign({}, scenarioWithMeta.meta || {}, seed ? { seed } : {});

    // Check if summarization is needed
    let conversationToUse = Array.isArray(sessionState.conversation) ? sessionState.conversation : [];
    console.log('📊 Session conversation type:', typeof conversationToUse, 'IsArray:', Array.isArray(conversationToUse), 'Length:', conversationToUse?.length);
    let summaryData = sessionState.conversationSummary;
    
    if (conversationSummarizer.needsSummarization(sessionState.conversation, sessionState)) {
      console.log('🔄 Triggering conversation summarization...');
      summaryData = await conversationSummarizer.summarizeConversation(
        sessionState.conversation,
        sessionState
      );
      
      // Use compressed conversation for API call
      conversationToUse = conversationSummarizer.buildCompressedConversation(
        summaryData,
        sessionState.conversation
      );
      
      const stats = conversationSummarizer.getStatistics(sessionState, sessionState.conversation);
      console.log(`💾 Token savings: ${stats.tokenSavings} tokens (${stats.compressionRatio} of original)`);
    } else if (summaryData?.summary) {
      // Use existing summary
      conversationToUse = conversationSummarizer.buildCompressedConversation(
        summaryData,
        sessionState.conversation
      );
    }

    // Create new ChatService instance (stateless)
    const chatService = new ChatService();
    
    // Generate response with session state (using compressed conversation)
    const result = await chatService.generateResponse(
      message, 
      conversationToUse, 
      scenarioWithMeta,
      sessionState // Pass full session state
    );

    // Update session with new conversation and any state changes
    console.log('📊 Result conversation type:', typeof result.conversation, 'IsArray:', Array.isArray(result.conversation));
    sessionManager.updateSession(currentSessionId, {
      conversation: result.conversation || [],
      conversationSummary: summaryData, // Store summary data
      scenarioData: result.enhancedScenarioData || scenarioWithMeta,
      patientState: result.patientState,
      performance: result.performance
    });

    res.json({
      success: true,
      data: {
        response: result.response,
        conversation: result.conversation,
        usage: result.usage,
        additionalMessages: result.additionalMessages || [],
        scenarioData: result.enhancedScenarioData || scenarioWithMeta,
        sessionId: currentSessionId // Return session ID to client
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat endpoint error:', error.message);

    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get conversation summary endpoint
router.post('/summarize', validateChatInput, async (req, res) => {
  try {
    const { conversation } = req.body;

    if (!conversation || conversation.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Conversation is required for summarization'
      });
    }

    // Create summarization prompt
    const conversationText = conversation
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const summaryPrompt = `Please provide a brief summary of the following conversation:\n\n${conversationText}`;

    const result = await chatService.generateResponse(summaryPrompt, []);

    res.json({
      success: true,
      data: {
        summary: result.response
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Summarization error:', error.message);

    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Create temporary ChatService instance to check models
    const chatService = new ChatService();
    const models = await chatService.getAvailableModels();
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        modelsAvailable: models.length > 0,
        sessionCount: sessionManager.getSessionCount(),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Service unhealthy',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Scoring endpoint using EMED111 rubric (with session support)
router.post('/score', async (req, res) => {
  try {
    const { conversation, scenarioData = null, sessionId = null, timeElapsed = null } = req.body || {};

    let finalConversation = conversation;
    let finalScenarioData = scenarioData;

    // If sessionId provided, get data from session
    if (sessionId && sessionManager.hasSession(sessionId)) {
      const sessionState = sessionManager.getSession(sessionId);
      const sessionConv = sessionState.conversation;
      finalConversation = Array.isArray(sessionConv) ? sessionConv : (conversation || []);
      finalScenarioData = sessionState.scenarioData || scenarioData;
      console.log(`📊 Scoring session: ${sessionId}`);
    }

    // Ensure conversation is always an array
    if (!Array.isArray(finalConversation)) {
      finalConversation = Array.isArray(conversation) ? conversation : [];
    }

    if (finalConversation.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Conversation is required for scoring'
      });
    }

    const timeSpentMinutes = typeof timeElapsed === 'number' && timeElapsed >= 0
      ? Math.round(timeElapsed / 60)
      : null;
    const examAssessmentResults = sessionId ? examAssessmentManager.getAssessmentResults(sessionId) : null;

    const gradingEngine = GradingEngine;
    const gradingResults = await gradingEngine.gradeScenario(
      finalConversation,
      finalScenarioData,
      timeSpentMinutes,
      examAssessmentResults
    );
    const feedbackReport = gradingEngine.generateFeedbackReport(gradingResults, finalScenarioData);

    // Build rubric breakdown: each section with name, score, maxScore, and full criteria (0-3)
    const rubricSections = gradingEngine.rubric.scoredSections;
    const rubricBreakdown = rubricSections.map((section) => {
      const result = gradingResults.scoredSections[section.id] || { score: 0, maxScore: section.maxScore, name: section.name, criteria: 'not attempted' };
      return {
        id: section.id,
        name: section.name,
        score: result.score,
        maxScore: result.maxScore,
        criteriaAchieved: result.criteria || section.criteria[0],
        criteriaLevels: section.criteria,
        feedback: result.feedback || []
      };
    });

    const totalScore = gradingResults.totalScore;
    const maxScore = gradingEngine.rubric.totalPoints;
    const scoreDisplay = `${totalScore}/${maxScore}`;

    const feedbackParts = [
      feedbackReport.summary.pass
        ? `Pass. Total score: ${totalScore}/${maxScore} (${feedbackReport.summary.percentage}%).`
        : `Did not pass. Total score: ${totalScore}/${maxScore} (${feedbackReport.summary.percentage}%).`,
      feedbackReport.strengths.length ? `\nStrengths:\n${feedbackReport.strengths.map(s => `- ${s}`).join('\n')}` : '',
      feedbackReport.areasForImprovement.length ? `\nAreas for improvement:\n${feedbackReport.areasForImprovement.map(a => `- ${a}`).join('\n')}` : '',
      feedbackReport.recommendations.length ? `\nRecommendations:\n${feedbackReport.recommendations.map(r => `- ${r}`).join('\n')}` : '',
      feedbackReport.summary.timeSpent != null ? `\nTime: ${feedbackReport.summary.timeSpent} min (limit: ${feedbackReport.summary.timeLimit} min).` : ''
    ];
    const feedbackText = feedbackParts.filter(Boolean).join('\n') || 'Feedback generated.';

    res.json({
      success: true,
      data: {
        feedback: feedbackText,
        score: scoreDisplay,
        rubricBreakdown,
        rubricTotalScore: totalScore,
        rubricMaxScore: maxScore,
        rubricPass: gradingResults.overallPass,
        checkboxItems: feedbackReport.checkboxItems
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Score endpoint error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get EMT interventions for a scenario
router.post('/interventions', async (req, res) => {
  try {
    const { scenarioData, sessionId = null } = req.body || {};

    let finalScenarioData = scenarioData;
    
    // If sessionId provided, get data from session
    if (sessionId && sessionManager.hasSession(sessionId)) {
      const sessionState = sessionManager.getSession(sessionId);
      finalScenarioData = sessionState.scenarioData || scenarioData;
    }

    if (!finalScenarioData) {
      return res.status(400).json({
        success: false,
        error: 'Scenario data is required to get interventions'
      });
    }

    // Create temporary ChatService instance
    const chatService = new ChatService();
    const interventions = chatService.getEmtInterventions(finalScenarioData);

    if (!interventions) {
      return res.status(404).json({
        success: false,
        error: 'No EMT interventions available for this scenario'
      });
    }

    res.json({
      success: true,
      data: {
        interventions: interventions,
        scenarioType: `${finalScenarioData.mainScenario} - ${finalScenarioData.subScenario}`
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Interventions endpoint error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Conversation summarization endpoint (for debugging/monitoring)
router.get('/session/:sessionId/summary', (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionManager.hasSession(sessionId)) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        timestamp: new Date().toISOString()
      });
    }
    
    const sessionState = sessionManager.getSession(sessionId);
    const conversation = sessionState.conversation || [];
    const stats = conversationSummarizer.getStatistics(sessionState, conversation);
    const formattedSummary = conversationSummarizer.formatSummary(sessionState.conversationSummary);
    
    res.json({
      success: true,
      data: {
        sessionId,
        statistics: stats,
        summary: formattedSummary,
        summaryData: sessionState.conversationSummary || null
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get summary error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Database & Analytics Endpoints

// Get database statistics
router.get('/database/stats', (req, res) => {
  try {
    const dbManager = require('../database/databaseManager');
    
    if (!dbManager.isInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Database not initialized',
        timestamp: new Date().toISOString()
      });
    }

    const stats = dbManager.getStatistics();
    const distribution = dbManager.getScenarioDistribution();
    const dbSize = dbManager.getDatabaseSize();

    res.json({
      success: true,
      data: {
        database: {
          size_mb: dbSize,
          ...stats
        },
        scenarioDistribution: distribution
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database stats error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get student progress
router.get('/student/:sunetId/progress', (req, res) => {
  try {
    const { sunetId } = req.params;
    const dbManager = require('../database/databaseManager');
    
    if (!dbManager.isInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Database not initialized'
      });
    }

    const progress = dbManager.getStudentProgress(sunetId);
    const sessions = dbManager.getStudentSessions(sunetId, 20);

    res.json({
      success: true,
      data: {
        student: progress,
        recentSessions: sessions
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Student progress error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get top students leaderboard
router.get('/leaderboard', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const dbManager = require('../database/databaseManager');
    
    if (!dbManager.isInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Database not initialized'
      });
    }

    const topStudents = dbManager.getTopStudents(limit);

    res.json({
      success: true,
      data: {
        leaderboard: topStudents
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Leaderboard error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Export session data (for instructors/review)
router.get('/session/:sessionId/export', (req, res) => {
  try {
    const { sessionId } = req.params;
    const dbManager = require('../database/databaseManager');
    
    if (!dbManager.isInitialized) {
      // Fall back to in-memory session
      if (!sessionManager.hasSession(sessionId)) {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }
      
      const sessionData = sessionManager.exportSession(sessionId);
      return res.json({
        success: true,
        data: sessionData,
        source: 'memory',
        timestamp: new Date().toISOString()
      });
    }

    const sessionData = dbManager.exportSession(sessionId);
    
    if (!sessionData) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      data: sessionData,
      source: 'database',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Export session error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Session management endpoints

// Get session state
router.get('/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionManager.hasSession(sessionId)) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        timestamp: new Date().toISOString()
      });
    }
    
    const sessionData = sessionManager.getSession(sessionId);
    
    res.json({
      success: true,
      data: {
        sessionId,
        session: sessionData
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get session error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Delete/end session
router.delete('/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const deleted = sessionManager.deleteSession(sessionId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      data: {
        message: 'Session deleted successfully',
        sessionId
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Delete session error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get session statistics (for monitoring)
router.get('/sessions/stats', (req, res) => {
  try {
    const stats = sessionManager.getStatistics();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Session stats error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;

// Transcription endpoint (server ASR via Whisper)
// Accepts JSON: { audio: "data:audio/webm;base64,...." } or { audio: "<base64>", mimeType: "audio/webm" }
router.post('/transcribe', async (req, res) => {
  try {
    const { audio, mimeType } = req.body || {};
    if (!audio || typeof audio !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing audio data' });
    }

    // Parse Data URL or raw base64
    let base64 = audio;
    let inferredMime = mimeType || 'audio/webm';
    const dataUrlMatch = audio.match(/^data:([^;]+);base64,(.+)$/);
    if (dataUrlMatch) {
      inferredMime = dataUrlMatch[1] || inferredMime;
      base64 = dataUrlMatch[2];
    }

    const buffer = Buffer.from(base64, 'base64');
    const ext = inferredMime.includes('wav') ? 'wav' : inferredMime.includes('mp3') ? 'mp3' : inferredMime.includes('m4a') ? 'm4a' : inferredMime.includes('ogg') ? 'ogg' : 'webm';
    const tmpPath = path.join(os.tmpdir(), `asr-${Date.now()}.${ext}`);
    fs.writeFileSync(tmpPath, buffer);

    try {
      const resp = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tmpPath),
        model: 'whisper-1',
        // smart punctuation/casing are handled by model defaults
        // language: 'en', // optional
      });

      const text = resp?.text || '';
      return res.json({ success: true, data: { text }, timestamp: new Date().toISOString() });
    } finally {
      // cleanup
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
  } catch (error) {
    console.error('Transcription error:', error.message);
    return res.status(500).json({ success: false, error: 'Transcription failed' });
  }
});