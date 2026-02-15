// services/sessionManager.js
const crypto = require('crypto');
const dbManager = require('../database/databaseManager');

/**
 * SessionManager - Manages scenario session state with database persistence
 * 
 * Hybrid Approach:
 * - Active sessions: In-memory for speed
 * - Database: Persistent storage, survives restarts
 * - Auto-save: Periodically persists sessions to database
 * - On startup: Can restore active sessions from database
 */
class SessionManager {
  constructor() {
    // In-memory session storage (for active sessions)
    this.sessions = new Map();
    
    // Session configuration
    this.sessionTimeout = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
    this.cleanupInterval = 15 * 60 * 1000; // Cleanup every 15 minutes
    this.autoSaveInterval = 30 * 1000; // Auto-save every 30 seconds
    
    // Database persistence flag
    this.persistenceEnabled = false;
    
    // Start automatic cleanup and save
    this.startCleanupTimer();
    this.startAutoSaveTimer();
    
    console.log('📦 SessionManager initialized (hybrid: memory + database)');
  }

  /**
   * Initialize database persistence
   */
  async enablePersistence() {
    try {
      await dbManager.initialize();
      this.persistenceEnabled = true;
      console.log('✅ Session persistence enabled');
      
      // Optionally restore active sessions
      await this.restoreActiveSessions();
      
      return true;
    } catch (error) {
      console.error('❌ Failed to enable persistence:', error);
      this.persistenceEnabled = false;
      return false;
    }
  }

  /**
   * Restore active sessions from database (on startup)
   */
  async restoreActiveSessions() {
    if (!this.persistenceEnabled) return 0;

    try {
      const activeSessions = dbManager.db.prepare(`
        SELECT * FROM sessions 
        WHERE status = 'active' 
        AND updated_at > ?
      `).all(Date.now() - this.sessionTimeout);

      let restoredCount = 0;
      for (const row of activeSessions) {
        try {
          const session = {
            id: row.id,
            createdAt: row.created_at,
            lastAccessed: row.updated_at,
            data: JSON.parse(row.session_data)
          };
          this.sessions.set(session.id, session);
          restoredCount++;
        } catch (error) {
          console.error(`Failed to restore session ${row.id}:`, error.message);
        }
      }

      if (restoredCount > 0) {
        console.log(`♻️  Restored ${restoredCount} active session(s) from database`);
      }
      
      return restoredCount;
    } catch (error) {
      console.error('Error restoring sessions:', error);
      return 0;
    }
  }

  /**
   * Create a new session
   * @param {Object} initialData - Initial session data
   * @returns {string} - Session ID
   */
  createSession(initialData = {}) {
    const sessionId = this.generateSessionId();
    
    const session = {
      id: sessionId,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      data: {
        // Scenario data
        scenarioData: initialData.scenarioData || null,
        
        // Patient state
        patientState: {
          vitalsHistory: [],
          interventionsPerformed: [],
          consciousnessLevel: 'alert',
          patientResponses: [],
          scenarioStartTime: null
        },
        
        // Performance tracking
        performance: {
          actionsPerformed: [],
          criticalActions: [],
          missedActions: [],
          timing: {}
        },
        
        // Conversation state
        conversation: initialData.conversation || [],
        conversationSummary: null, // Stores summarization data
        
        // Scenario metadata
        meta: {
          startTime: null,
          endTime: null,
          endReason: null,
          timeLimitMinutes: 20
        },
        
        // User info
        sunetId: initialData.sunetId || null,
        
        // Custom data
        ...initialData
      }
    };
    
    this.sessions.set(sessionId, session);
    console.log(`✅ Created session: ${sessionId}`);
    
    return sessionId;
  }

  /**
   * Get session data
   * @param {string} sessionId - Session ID
   * @returns {Object|null} - Session data or null if not found
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      console.log(`❌ Session not found: ${sessionId}`);
      return null;
    }
    
    // Update last accessed time
    session.lastAccessed = Date.now();
    this.sessions.set(sessionId, session);
    
    return session.data;
  }

  /**
   * Update session data
   * @param {string} sessionId - Session ID
   * @param {Object} updates - Data to update (deep merge)
   * @returns {boolean} - Success status
   */
  updateSession(sessionId, updates) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      console.log(`❌ Cannot update - session not found: ${sessionId}`);
      return false;
    }
    
    // Deep merge updates into session data
    session.data = this.deepMerge(session.data, updates);
    session.lastAccessed = Date.now();
    
    this.sessions.set(sessionId, session);
    console.log(`✅ Updated session: ${sessionId}`);
    
    return true;
  }

  /**
   * Delete session
   * @param {string} sessionId - Session ID
   * @param {boolean} permanent - Also delete from database
   * @returns {boolean} - Success status
   */
  deleteSession(sessionId, permanent = false) {
    const session = this.sessions.get(sessionId);
    const deleted = this.sessions.delete(sessionId);
    
    if (deleted) {
      console.log(`🗑️ Deleted session from memory: ${sessionId}`);
      
      // Mark as completed/abandoned in database (don't delete)
      if (this.persistenceEnabled && !permanent) {
        dbManager.updateSessionStatus(sessionId, 'abandoned');
      }
    } else {
      console.log(`❌ Cannot delete - session not found: ${sessionId}`);
    }
    
    return deleted;
  }

  /**
   * Complete session and save final state
   * @param {string} sessionId - Session ID
   * @param {Object} finalData - Final performance data
   */
  completeSession(sessionId, finalData = {}) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      console.log(`❌ Cannot complete - session not found: ${sessionId}`);
      return false;
    }

    // Save final state to database
    if (this.persistenceEnabled) {
      dbManager.saveSession(session);
      dbManager.updateSessionStatus(sessionId, 'completed', finalData);
      console.log(`✅ Session completed and saved: ${sessionId}`);
    }

    // Remove from active memory
    this.sessions.delete(sessionId);
    
    return true;
  }

  /**
   * Check if session exists
   * @param {string} sessionId - Session ID
   * @returns {boolean} - Existence status
   */
  hasSession(sessionId) {
    return this.sessions.has(sessionId);
  }

  /**
   * Get all active session IDs (for monitoring)
   * @returns {Array} - Array of session IDs
   */
  getActiveSessions() {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get session count (for monitoring)
   * @returns {number} - Number of active sessions
   */
  getSessionCount() {
    return this.sessions.size;
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now - session.lastAccessed;
      
      if (age > this.sessionTimeout) {
        this.sessions.delete(sessionId);
        cleanedCount++;
        console.log(`🧹 Cleaned up expired session: ${sessionId} (inactive for ${Math.round(age / 60000)} minutes)`);
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleanup complete: Removed ${cleanedCount} expired session(s)`);
    }
    
    return cleanedCount;
  }

  /**
   * Start automatic cleanup timer
   */
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.cleanupInterval);
    
    console.log('🕐 Session cleanup timer started');
  }

  /**
   * Start automatic save timer (persist sessions periodically)
   */
  startAutoSaveTimer() {
    this.autoSaveTimer = setInterval(() => {
      this.autoSaveAllSessions();
    }, this.autoSaveInterval);
    
    console.log('💾 Auto-save timer started');
  }

  /**
   * Automatically save all active sessions to database
   */
  autoSaveAllSessions() {
    if (!this.persistenceEnabled || this.sessions.size === 0) {
      return;
    }

    let savedCount = 0;
    for (const [sessionId, session] of this.sessions.entries()) {
      try {
        if (dbManager.saveSession(session)) {
          savedCount++;
        }
      } catch (error) {
        console.error(`Failed to auto-save session ${sessionId}:`, error.message);
      }
    }

    if (savedCount > 0) {
      console.log(`💾 Auto-saved ${savedCount} session(s) to database`);
    }
  }

  /**
   * Stop automatic cleanup timer
   */
  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      console.log('⏹️ Session cleanup timer stopped');
    }
  }

  /**
   * Stop automatic save timer
   */
  stopAutoSaveTimer() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
      console.log('⏹️ Auto-save timer stopped');
    }
  }

  /**
   * Generate unique session ID
   * @returns {string} - Session ID
   */
  generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Deep merge objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} - Merged object
   */
  deepMerge(target, source) {
    const output = { ...target };
    
    for (const key in source) {
      if (source[key] instanceof Object && key in target) {
        output[key] = this.deepMerge(target[key], source[key]);
      } else {
        output[key] = source[key];
      }
    }
    
    return output;
  }

  /**
   * Export session data (for saving to database)
   * @param {string} sessionId - Session ID
   * @returns {Object|null} - Complete session object
   */
  exportSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Import session data (for loading from database)
   * @param {Object} sessionData - Complete session object
   * @returns {string|null} - Session ID or null if invalid
   */
  importSession(sessionData) {
    if (!sessionData || !sessionData.id) {
      console.log('❌ Cannot import - invalid session data');
      return null;
    }
    
    this.sessions.set(sessionData.id, sessionData);
    console.log(`📥 Imported session: ${sessionData.id}`);
    
    return sessionData.id;
  }

  /**
   * Get session statistics (for monitoring)
   * @returns {Object} - Session statistics
   */
  getStatistics() {
    const now = Date.now();
    let totalAge = 0;
    let oldestAge = 0;
    
    for (const session of this.sessions.values()) {
      const age = now - session.createdAt;
      totalAge += age;
      if (age > oldestAge) oldestAge = age;
    }
    
    const count = this.sessions.size;
    
    return {
      totalSessions: count,
      averageAgeMinutes: count > 0 ? Math.round(totalAge / count / 60000) : 0,
      oldestSessionMinutes: Math.round(oldestAge / 60000),
      memoryUsageEstimateMB: this.estimateMemoryUsage()
    };
  }

  /**
   * Estimate memory usage (rough estimate)
   * @returns {number} - Estimated MB
   */
  estimateMemoryUsage() {
    // Rough estimate: ~50KB per session average
    return Math.round((this.sessions.size * 50) / 1024 * 100) / 100;
  }

  /**
   * Shutdown cleanup
   */
  async shutdown() {
    this.stopCleanupTimer();
    this.stopAutoSaveTimer();
    
    // Final save of all active sessions
    if (this.persistenceEnabled && this.sessions.size > 0) {
      console.log(`💾 Final save of ${this.sessions.size} session(s)...`);
      this.autoSaveAllSessions();
    }
    
    console.log(`📦 SessionManager shutdown - ${this.sessions.size} sessions in memory`);
    
    // Close database connection
    if (this.persistenceEnabled) {
      dbManager.close();
    }
  }
}

// Export singleton instance
const sessionManager = new SessionManager();

// Graceful shutdown
process.on('SIGTERM', () => sessionManager.shutdown());
process.on('SIGINT', () => sessionManager.shutdown());

module.exports = sessionManager;
