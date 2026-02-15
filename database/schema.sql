-- EMT Scenario Trainer Database Schema
-- SQLite Schema (easily portable to PostgreSQL)

-- Sessions Table: Stores all scenario sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  sunet_id TEXT NOT NULL,
  session_data TEXT NOT NULL,  -- JSON blob of full session state
  status TEXT DEFAULT 'active',  -- active, completed, abandoned
  created_at INTEGER NOT NULL,  -- Unix timestamp
  updated_at INTEGER NOT NULL,  -- Unix timestamp
  completed_at INTEGER,  -- Unix timestamp
  
  -- Scenario information
  scenario_type TEXT,  -- Medical, Trauma
  scenario_subtype TEXT,  -- Cardiac, MVC, etc.
  
  -- Performance metrics (extracted for easy querying)
  performance_score INTEGER,  -- 0-100
  time_elapsed INTEGER,  -- Seconds
  actions_count INTEGER,  -- Number of actions performed
  critical_actions_completed INTEGER,  -- Number of critical actions done
  
  -- Analytics
  conversation_length INTEGER DEFAULT 0,  -- Number of messages
  summarization_triggered INTEGER DEFAULT 0  -- Boolean (0/1)
);

-- Indexes for sessions table
CREATE INDEX IF NOT EXISTS idx_sunet_id ON sessions(sunet_id);
CREATE INDEX IF NOT EXISTS idx_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_created_at ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_scenario_type ON sessions(scenario_type, scenario_subtype);

-- Performance Details Table: Detailed action tracking
CREATE TABLE IF NOT EXISTS session_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  action_type TEXT NOT NULL,  -- vitalCheck, medicationAdmin, etc.
  action_data TEXT,  -- JSON details
  performed_at INTEGER NOT NULL,  -- Unix timestamp
  time_from_start INTEGER,  -- Seconds from scenario start
  is_critical INTEGER DEFAULT 0,  -- Boolean
  is_correct INTEGER DEFAULT 1,  -- Boolean
  
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Indexes for session_actions table
CREATE INDEX IF NOT EXISTS idx_session_actions ON session_actions(session_id);

-- Conversation Messages Table: Full conversation history
CREATE TABLE IF NOT EXISTS conversation_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,  -- user, assistant, system
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  message_index INTEGER NOT NULL,  -- Order in conversation
  
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Indexes for conversation_messages table
CREATE INDEX IF NOT EXISTS idx_session_messages ON conversation_messages(session_id, message_index);

-- Students Table: Student profiles and progress
CREATE TABLE IF NOT EXISTS students (
  sunet_id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  cohort TEXT,  -- e.g., "2025-2026"
  created_at INTEGER NOT NULL,
  last_active INTEGER,
  
  -- Aggregate stats
  total_scenarios INTEGER DEFAULT 0,
  completed_scenarios INTEGER DEFAULT 0,
  average_score REAL DEFAULT 0,
  total_time_minutes INTEGER DEFAULT 0
);

-- Indexes for students table
CREATE INDEX IF NOT EXISTS idx_cohort ON students(cohort);

-- Scenario Templates: Reusable scenario configurations
CREATE TABLE IF NOT EXISTS scenario_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  scenario_type TEXT NOT NULL,
  scenario_subtype TEXT NOT NULL,
  difficulty TEXT,  -- novice, intermediate, advanced
  template_data TEXT NOT NULL,  -- JSON configuration
  created_by TEXT,  -- Instructor SUNet ID
  created_at INTEGER NOT NULL,
  use_count INTEGER DEFAULT 0
);

-- Indexes for scenario_templates table
CREATE INDEX IF NOT EXISTS idx_template_type ON scenario_templates(scenario_type, scenario_subtype);

-- Feedback/Grading: Instructor feedback on scenarios
CREATE TABLE IF NOT EXISTS session_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  instructor_id TEXT,
  grade REAL,  -- 0-100
  feedback_text TEXT,
  strengths TEXT,  -- JSON array
  improvements TEXT,  -- JSON array
  created_at INTEGER NOT NULL,
  
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Audit Log: Track all database changes
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,  -- CREATE, UPDATE, DELETE
  user_id TEXT,
  changes TEXT,  -- JSON of what changed
  timestamp INTEGER NOT NULL
);

-- Indexes for audit_log table
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_log(table_name, record_id);

-- System Configuration: App-level settings
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Insert default configuration
INSERT OR IGNORE INTO system_config (key, value, updated_at) VALUES
  ('schema_version', '1.0.0', strftime('%s', 'now')),
  ('initialized_at', strftime('%s', 'now'), strftime('%s', 'now')),
  ('session_timeout_hours', '2', strftime('%s', 'now')),
  ('auto_cleanup_enabled', '1', strftime('%s', 'now'));
