// server.js
require('dotenv').config();

// Add debug logging to confirm API key is loaded
console.log('🔧 dotenv loaded');
console.log('🔑 API Key exists:', !!process.env.OPENAI_API_KEY);
console.log('🔑 API Key preview:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 15) + '...' : 'NOT FOUND');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const chatRoutes = require('./routes/chat');
const { testConnection } = require('./config/openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});

app.use('/api', limiter);  // ✅ FIXED - removed trailing slash

// Routes
app.use('/api', chatRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Custom GPT Backend is running!',
    status: 'success',
    endpoints: {
      chat: 'POST /api/chat',
      summarize: 'POST /api/summarize',
      health: 'GET /api/health'
    },
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    success: false,
    error: 'Something went wrong!',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    timestamp: new Date().toISOString()
  });
});

// Start server
async function startServer() {
  try {
    // Test OpenAI connection
    const connectionOk = await testConnection();
    
    if (!connectionOk) {
      console.error('Failed to connect to OpenAI. Please check your API key.');
      process.exit(1);
    }

    app.listen(PORT, () => {
      console.log(`✅ Server is running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 API URL: http://localhost:${PORT}/api`);
    });

  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();