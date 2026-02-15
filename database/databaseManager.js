// database/databaseManager.js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

/**
 * DatabaseManager - Handles all database operations
 * 
 * Features:
 * - Session persistence (survives restarts)
 * - Historical data storage
 * - Student progress tracking
 * - Analytics queries
 * - Audit logging
 */
class DatabaseManager {
  constructor(dbPath = './database/emt-scenarios.db') {
    this.dbPath = dbPath;
    this.db = null;
    this.isInitialized = false;
  }

  /**
   * Initialize database connection and schema
   */
  async initialize() {
    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Open database connection
      this.db = new Database(this.dbPath);
      
      // Enable foreign keys
      this.db.pragma('foreign_keys = ON');
      
      // Set journal mode for better concurrency
      this.db.pragma('journal_mode = WAL');
      
      // Initialize schema
      await this.initializeSchema();
      
      this.isInitialized = true;
      console.log('💾 Database initialized:', this.dbPath);
      
      // Log statistics
      const stats = this.getStatistics();
      console.log(`📊 Database stats: ${stats.totalSessions} sessions, ${stats.totalStudents} students`);
      
      return true;
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize database schema from SQL file
   */
  async initializeSchema() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema (SQLite handles CREATE IF NOT EXISTS)
    this.db.exec(schema);
    
    console.log('✅ Database schema initialized');
  }

  // ==================== SESSION OPERATIONS ====================

  /**
   * Save session to database
   * @param {Object} session - Full session object
   * @returns {boolean} - Success status
   */
  saveSession(session) {
    if (!this.isInitialized) return false;

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO sessions (
          id, sunet_id, session_data, status, created_at, updated_at,
          scenario_type, scenario_subtype, conversation_length
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const sessionData = JSON.stringify(session.data || session);
      const scenarioData = session.data?.scenarioData || {};
      
      stmt.run(
        session.id,
        session.data?.sunetId || 'unknown',
        sessionData,
        'active',
        session.createdAt || Date.now(),
        Date.now(),
        scenarioData.mainScenario || null,
        scenarioData.subScenario || null,
        (session.data?.conversation || []).length
      );

      return true;
    } catch (error) {
      console.error('Error saving session:', error);
      return false;
    }
  }

  /**
   * Load session from database
   * @param {string} sessionId - Session ID
   * @returns {Object|null} - Session object or null
   */
  loadSession(sessionId) {
    if (!this.isInitialized) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
      const row = stmt.get(sessionId);
      
      if (!row) return null;

      // Parse session data
      const session = {
        id: row.id,
        createdAt: row.created_at,
        lastAccessed: row.updated_at,
        data: JSON.parse(row.session_data)
      };

      return session;
    } catch (error) {
      console.error('Error loading session:', error);
      return null;
    }
  }

  /**
   * Update session status
   * @param {string} sessionId - Session ID
   * @param {string} status - New status (active, completed, abandoned)
   * @param {Object} finalData - Optional final performance data
   */
  updateSessionStatus(sessionId, status, finalData = {}) {
    if (!this.isInitialized) return false;

    try {
      const stmt = this.db.prepare(`
        UPDATE sessions 
        SET status = ?, 
            updated_at = ?,
            completed_at = ?,
            performance_score = ?,
            time_elapsed = ?,
            actions_count = ?
        WHERE id = ?
      `);

      stmt.run(
        status,
        Date.now(),
        status === 'completed' ? Date.now() : null,
        finalData.score || null,
        finalData.timeElapsed || null,
        finalData.actionsCount || null,
        sessionId
      );

      return true;
    } catch (error) {
      console.error('Error updating session status:', error);
      return false;
    }
  }

  /**
   * Delete old sessions (cleanup)
   * @param {number} olderThanDays - Delete sessions older than N days
   * @returns {number} - Number of deleted sessions
   */
  deleteOldSessions(olderThanDays = 30) {
    if (!this.isInitialized) return 0;

    try {
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      
      const stmt = this.db.prepare(`
        DELETE FROM sessions 
        WHERE updated_at < ? AND status != 'active'
      `);

      const result = stmt.run(cutoffTime);
      console.log(`🗑️ Deleted ${result.changes} old sessions`);
      
      return result.changes;
    } catch (error) {
      console.error('Error deleting old sessions:', error);
      return 0;
    }
  }

  // ==================== STUDENT OPERATIONS ====================

  /**
   * Create or update student profile
   * @param {Object} studentData - Student information
   */
  upsertStudent(studentData) {
    if (!this.isInitialized) return false;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO students (sunet_id, name, email, cohort, created_at, last_active)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(sunet_id) DO UPDATE SET
          name = excluded.name,
          email = excluded.email,
          last_active = excluded.last_active
      `);

      stmt.run(
        studentData.sunetId,
        studentData.name || null,
        studentData.email || null,
        studentData.cohort || '2025-2026',
        Date.now(),
        Date.now()
      );

      return true;
    } catch (error) {
      console.error('Error upserting student:', error);
      return false;
    }
  }

  /**
   * Get student progress
   * @param {string} sunetId - Student SUNet ID
   * @returns {Object} - Student stats
   */
  getStudentProgress(sunetId) {
    if (!this.isInitialized) return null;

    try {
      const stmt = this.db.prepare(`
        SELECT 
          s.*,
          COUNT(sess.id) as total_scenarios,
          COUNT(CASE WHEN sess.status = 'completed' THEN 1 END) as completed_scenarios,
          AVG(sess.performance_score) as avg_score,
          SUM(sess.time_elapsed) / 60 as total_time_minutes
        FROM students s
        LEFT JOIN sessions sess ON s.sunet_id = sess.sunet_id
        WHERE s.sunet_id = ?
        GROUP BY s.sunet_id
      `);

      return stmt.get(sunetId);
    } catch (error) {
      console.error('Error getting student progress:', error);
      return null;
    }
  }

  /**
   * Get all sessions for a student
   * @param {string} sunetId - Student SUNet ID
   * @param {number} limit - Max number of sessions
   * @returns {Array} - Array of sessions
   */
  getStudentSessions(sunetId, limit = 50) {
    if (!this.isInitialized) return [];

    try {
      const stmt = this.db.prepare(`
        SELECT 
          id, scenario_type, scenario_subtype, status,
          performance_score, time_elapsed, conversation_length,
          created_at, completed_at
        FROM sessions
        WHERE sunet_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `);

      return stmt.all(sunetId, limit);
    } catch (error) {
      console.error('Error getting student sessions:', error);
      return [];
    }
  }

  // ==================== ANALYTICS OPERATIONS ====================

  /**
   * Get database statistics
   * @returns {Object} - Statistics object
   */
  getStatistics() {
    if (!this.isInitialized) return {};

    try {
      const stats = this.db.prepare(`
        SELECT 
          (SELECT COUNT(*) FROM sessions) as totalSessions,
          (SELECT COUNT(*) FROM sessions WHERE status = 'active') as activeSessions,
          (SELECT COUNT(*) FROM sessions WHERE status = 'completed') as completedSessions,
          (SELECT COUNT(*) FROM students) as totalStudents,
          (SELECT AVG(performance_score) FROM sessions WHERE performance_score IS NOT NULL) as avgScore,
          (SELECT SUM(time_elapsed) / 60 FROM sessions WHERE time_elapsed IS NOT NULL) as totalTimeMinutes
      `).get();

      return stats;
    } catch (error) {
      console.error('Error getting statistics:', error);
      return {};
    }
  }

  /**
   * Get scenario type distribution
   * @returns {Array} - Array of scenario type counts
   */
  getScenarioDistribution() {
    if (!this.isInitialized) return [];

    try {
      const stmt = this.db.prepare(`
        SELECT 
          scenario_type,
          scenario_subtype,
          COUNT(*) as count,
          AVG(performance_score) as avg_score
        FROM sessions
        WHERE scenario_type IS NOT NULL
        GROUP BY scenario_type, scenario_subtype
        ORDER BY count DESC
      `);

      return stmt.all();
    } catch (error) {
      console.error('Error getting scenario distribution:', error);
      return [];
    }
  }

  /**
   * Get top performing students
   * @param {number} limit - Number of students to return
   * @returns {Array} - Array of top students
   */
  getTopStudents(limit = 10) {
    if (!this.isInitialized) return [];

    try {
      const stmt = this.db.prepare(`
        SELECT 
          s.sunet_id,
          s.name,
          COUNT(sess.id) as completed,
          AVG(sess.performance_score) as avg_score
        FROM students s
        INNER JOIN sessions sess ON s.sunet_id = sess.sunet_id
        WHERE sess.status = 'completed' AND sess.performance_score IS NOT NULL
        GROUP BY s.sunet_id, s.name
        HAVING completed >= 3
        ORDER BY avg_score DESC
        LIMIT ?
      `);

      return stmt.all(limit);
    } catch (error) {
      console.error('Error getting top students:', error);
      return [];
    }
  }

  // ==================== UTILITY OPERATIONS ====================

  /**
   * Vacuum database (reclaim space)
   */
  vacuum() {
    if (!this.isInitialized) return;
    
    try {
      console.log('🧹 Vacuuming database...');
      this.db.exec('VACUUM');
      console.log('✅ Database vacuumed');
    } catch (error) {
      console.error('Error vacuuming database:', error);
    }
  }

  /**
   * Export session data for backup
   * @param {string} sessionId - Session ID to export
   * @returns {Object} - Complete session data
   */
  exportSession(sessionId) {
    if (!this.isInitialized) return null;

    try {
      const session = this.loadSession(sessionId);
      if (!session) return null;

      // Get conversation messages
      const messages = this.db.prepare(`
        SELECT role, content, message_index
        FROM conversation_messages
        WHERE session_id = ?
        ORDER BY message_index
      `).all(sessionId);

      // Get actions
      const actions = this.db.prepare(`
        SELECT action_type, action_data, performed_at, is_critical
        FROM session_actions
        WHERE session_id = ?
        ORDER BY performed_at
      `).all(sessionId);

      return {
        ...session,
        messages,
        actions
      };
    } catch (error) {
      console.error('Error exporting session:', error);
      return null;
    }
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      console.log('💾 Database connection closed');
    }
  }

  /**
   * Get database file size
   * @returns {number} - Size in MB
   */
  getDatabaseSize() {
    try {
      const stats = fs.statSync(this.dbPath);
      return (stats.size / (1024 * 1024)).toFixed(2);
    } catch (error) {
      return 0;
    }
  }
}

// Export singleton instance
const dbManager = new DatabaseManager();

// Graceful shutdown
process.on('SIGTERM', () => dbManager.close());
process.on('SIGINT', () => dbManager.close());

module.exports = dbManager;
