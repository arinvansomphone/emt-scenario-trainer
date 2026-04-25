// services/conversationSummarizer.js
const { openai } = require('../config/openai');

/**
 * ConversationSummarizer - Manages conversation summarization to prevent context overflow
 * 
 * Strategy:
 * - Keep recent N messages in full detail (high-fidelity context)
 * - Summarize older messages into condensed format
 * - Preserve critical information (actions, vitals, key findings)
 * - Reduce token usage while maintaining scenario continuity
 */
class ConversationSummarizer {
  constructor() {
    // Configuration
    this.recentMessageWindow = 10;        // Keep last 10 messages in full
    this.summarizationThreshold = 20;     // Trigger summary at 20 messages
    this.maxSummaryTokens = 500;          // Keep summaries concise
    this.summaryModel = 'gpt-4o-mini';    // Fast, efficient model for summaries
    
    console.log('📝 ConversationSummarizer initialized');
  }

  /**
   * Check if conversation needs summarization
   * @param {Array} conversation - Full conversation history
   * @param {Object} sessionState - Current session state
   * @returns {boolean} - Whether summarization is needed
   */
  needsSummarization(conversation, sessionState) {
    if (!Array.isArray(conversation) || conversation.length === 0) {
      return false;
    }

    // Don't summarize if we already have a recent summary
    const lastSummaryAt = sessionState?.conversationSummary?.lastSummaryAt || 0;
    const messagesSinceLastSummary = conversation.length - lastSummaryAt;

    // Trigger if we've exceeded threshold and added enough new messages
    return conversation.length >= this.summarizationThreshold && 
           messagesSinceLastSummary >= 10;
  }

  /**
   * Summarize conversation to reduce context size
   * @param {Array} conversation - Full conversation history
   * @param {Object} sessionState - Current session state
   * @returns {Object} - Summarized conversation structure
   */
  async summarizeConversation(conversation, sessionState) {
    try {
      console.log(`📝 Starting conversation summarization (${conversation.length} messages)...`);

      // Split conversation into parts
      const recentMessages = conversation.slice(-this.recentMessageWindow);
      const messagesToSummarize = conversation.slice(0, -this.recentMessageWindow);

      // If we already have a summary, only summarize new messages
      const existingSummary = sessionState?.conversationSummary?.summary || null;
      const lastSummaryIndex = sessionState?.conversationSummary?.lastSummaryAt || 0;
      
      let summaryText;
      if (existingSummary && lastSummaryIndex > 0) {
        // Incremental summarization - summarize only new messages
        const newMessages = conversation.slice(lastSummaryIndex, -this.recentMessageWindow);
        summaryText = await this.generateIncrementalSummary(existingSummary, newMessages);
      } else {
        // Full summarization - first time
        summaryText = await this.generateFullSummary(messagesToSummarize, sessionState);
      }

      const result = {
        summary: summaryText,
        lastSummaryAt: conversation.length - this.recentMessageWindow,
        summarizedCount: conversation.length - this.recentMessageWindow,
        recentMessages: recentMessages,
        createdAt: Date.now()
      };

      console.log(`✅ Summarization complete: ${result.summarizedCount} messages → ${summaryText.length} chars`);
      return result;

    } catch (error) {
      console.error('❌ Summarization failed:', error.message);
      // On error, return conversation as-is
      return {
        summary: null,
        lastSummaryAt: 0,
        summarizedCount: 0,
        recentMessages: conversation,
        error: error.message
      };
    }
  }

  /**
   * Generate full summary from scratch
   * @param {Array} messages - Messages to summarize
   * @param {Object} sessionState - Session context
   * @returns {string} - Summary text
   */
  async generateFullSummary(messages, sessionState) {
    if (messages.length === 0) {
      return '';
    }

    // Build conversation text
    const conversationText = messages
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n');

    const scenarioType = sessionState?.scenarioData?.subScenario || 'unknown';

    const prompt = `You are summarizing an EMT training scenario conversation. Create a concise summary that preserves critical information.

SCENARIO TYPE: ${scenarioType}

INSTRUCTIONS:
- Focus on: actions taken, vitals checked, treatments given, key findings, patient responses
- Maintain chronological order
- Use bullet points for clarity
- Keep it under 400 words
- DO NOT include: greetings, acknowledgments, or filler
- Preserve specific vital signs, medications, and dosages

CONVERSATION TO SUMMARIZE:
${conversationText}

SUMMARY:`;

    try {
      const response = await openai.chat.completions.create({
        model: this.summaryModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: this.maxSummaryTokens,
        temperature: 0.3 // Low temperature for factual summary
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Failed to generate summary:', error);
      throw error;
    }
  }

  /**
   * Generate incremental summary (append to existing summary)
   * @param {string} existingSummary - Previous summary
   * @param {Array} newMessages - New messages since last summary
   * @returns {string} - Updated summary
   */
  async generateIncrementalSummary(existingSummary, newMessages) {
    if (newMessages.length === 0) {
      return existingSummary;
    }

    // Build new conversation text
    const newConversationText = newMessages
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n');

    const prompt = `You are updating an EMT training scenario summary with new information.

EXISTING SUMMARY:
${existingSummary}

NEW CONVERSATION:
${newConversationText}

INSTRUCTIONS:
- Integrate new information into existing summary
- Maintain chronological flow
- Avoid redundancy - don't repeat information already in summary
- Focus on new actions, vitals, treatments, findings
- Keep total length under 500 words
- Use bullet points for new items

UPDATED SUMMARY:`;

    try {
      const response = await openai.chat.completions.create({
        model: this.summaryModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: this.maxSummaryTokens,
        temperature: 0.3
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Failed to generate incremental summary:', error);
      throw error;
    }
  }

  /**
   * Build compressed conversation for API calls
   * @param {Object} summaryData - Summary data from session
   * @param {Array} fullConversation - Full conversation (for recent messages)
   * @returns {Array} - Compressed conversation array
   */
  buildCompressedConversation(summaryData, fullConversation) {
    const safeConversation = Array.isArray(fullConversation) ? fullConversation : [];
    if (!summaryData || !summaryData.summary) {
      // No summary available, use full conversation
      return safeConversation;
    }
    fullConversation = safeConversation;

    // Build compressed version: [summary message] + [recent messages]
    const compressed = [];

    // Add summary as a system message
    compressed.push({
      role: 'system',
      content: `CONVERSATION SUMMARY (previous messages):\n${summaryData.summary}`
    });

    // Add recent messages in full detail
    const recentMessages = fullConversation.slice(-this.recentMessageWindow);
    compressed.push(...recentMessages);

    console.log(`📦 Compressed conversation: ${fullConversation.length} → ${compressed.length} messages`);
    
    return compressed;
  }

  /**
   * Estimate token count (rough approximation)
   * @param {Array} conversation - Conversation array
   * @returns {number} - Estimated token count
   */
  estimateTokenCount(conversation) {
    if (!Array.isArray(conversation)) return 0;
    
    const totalChars = conversation.reduce((sum, msg) => {
      return sum + (msg.content?.length || 0);
    }, 0);
    
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(totalChars / 4);
  }

  /**
   * Get summarization statistics
   * @param {Object} sessionState - Session state
   * @param {Array} fullConversation - Full conversation
   * @returns {Object} - Statistics
   */
  getStatistics(sessionState, fullConversation) {
    const summaryData = sessionState?.conversationSummary;
    const fullTokens = this.estimateTokenCount(fullConversation);
    
    let compressedTokens = fullTokens;
    if (summaryData?.summary) {
      const compressed = this.buildCompressedConversation(summaryData, fullConversation);
      compressedTokens = this.estimateTokenCount(compressed);
    }

    return {
      totalMessages: fullConversation.length,
      summarizedMessages: summaryData?.summarizedCount || 0,
      recentMessages: this.recentMessageWindow,
      hasSummary: !!summaryData?.summary,
      estimatedFullTokens: fullTokens,
      estimatedCompressedTokens: compressedTokens,
      tokenSavings: fullTokens - compressedTokens,
      compressionRatio: fullTokens > 0 ? ((compressedTokens / fullTokens) * 100).toFixed(1) + '%' : 'N/A'
    };
  }

  /**
   * Format summary for display (for debugging/monitoring)
   * @param {Object} summaryData - Summary data
   * @returns {string} - Formatted summary
   */
  formatSummary(summaryData) {
    if (!summaryData || !summaryData.summary) {
      return 'No summary available - threshold not reached yet';
    }

    try {
      return `
📝 CONVERSATION SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Summarized: ${summaryData.summarizedCount || 0} messages
Created: ${summaryData.createdAt ? new Date(summaryData.createdAt).toLocaleTimeString() : 'N/A'}

${summaryData.summary || 'Summary generation in progress...'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Recent messages: Last ${this.recentMessageWindow} in full detail
`.trim();
    } catch (error) {
      return `Error formatting summary: ${error.message}`;
    }
  }
}

module.exports = ConversationSummarizer;
