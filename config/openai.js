// config/openai.js
require('dotenv').config();

const OpenAI = require('openai');

// Validate API key
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not defined in environment variables');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Test the connection
async function testConnection() {
  try {
    const response = await openai.models.list();
    console.log('✅ OpenAI connection successful');
    return true;
  } catch (error) {
    console.error('❌ OpenAI connection failed:', error.message);
    return false;
  }
}

module.exports = { openai, testConnection };