// routes/chat.js
const express = require('express');
const ChatService = require('../services/chatService');
const chatService = new ChatService();
const router = express.Router();
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openai } = require('../config/openai');

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

// Main chat endpoint
router.post('/chat', validateChatInput, async (req, res) => {
  try {
    const { message, conversation = [], scenarioData = null } = req.body;

    console.log(`Received message: ${message.substring(0, 100)}...`);
    console.log('Scenario data:', scenarioData);

    const result = await chatService.generateResponse(message, conversation, scenarioData);

    res.json({
      success: true,
      data: {
        response: result.response,
        conversation: result.conversation,
        usage: result.usage,
        scenarioData: result.enhancedScenarioData || scenarioData // Include enhanced scenario data
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
    const models = await chatService.getAvailableModels();
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        modelsAvailable: models.length > 0,
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

// Scoring endpoint using full rubric
router.post('/score', async (req, res) => {
  try {
    const { conversation, scenarioData = null } = req.body || {};

    if (!conversation || !Array.isArray(conversation) || conversation.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Conversation is required for scoring'
      });
    }

    const result = await chatService.generateScoredFeedback(conversation, scenarioData);

    res.json({
      success: true,
      data: {
        feedback: result.response,
        usage: result.usage,
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
    const { scenarioData } = req.body || {};

    if (!scenarioData) {
      return res.status(400).json({
        success: false,
        error: 'Scenario data is required to get interventions'
      });
    }

    const interventions = chatService.getEmtInterventions(scenarioData);

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
        scenarioType: `${scenarioData.mainScenario} - ${scenarioData.subScenario}`
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