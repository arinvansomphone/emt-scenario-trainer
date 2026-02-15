# Database Layer Documentation

## Overview

The EMT Scenario Trainer now includes a **SQLite database layer** for persistent storage, analytics, and institutional deployment.

## Architecture

### Hybrid Approach

```
┌─────────────────────────────────────┐
│   Active Sessions (In-Memory)      │  ← Fast access
│   - Current scenarios               │
│   - Real-time updates               │
└──────────┬──────────────────────────┘
           │ Auto-save every 30s
           ↓
┌─────────────────────────────────────┐
│   SQLite Database (Disk)            │  ← Persistent
│   - Historical data                  │
│   - Analytics                        │
│   - Student progress                 │
└─────────────────────────────────────┘
```

### Benefits

- ✅ **Persistence**: Survives server restarts
- ✅ **History**: Full audit trail of all scenarios
- ✅ **Analytics**: Student progress, performance trends
- ✅ **Scalability**: Ready for institutional deployment
- ✅ **No Breaking Changes**: Works with existing code

## Database Schema

### Main Tables

1. **sessions** - All scenario sessions
2. **students** - Student profiles and progress
3. **session_actions** - Detailed action tracking
4. **conversation_messages** - Full conversation history
5. **scenario_templates** - Reusable scenarios
6. **session_feedback** - Instructor feedback/grading
7. **audit_log** - System audit trail

See `schema.sql` for complete schema.

## API Endpoints

### Database Statistics

```bash
GET /api/database/stats
```

**Response**:
```json
{
  "success": true,
  "data": {
    "database": {
      "size_mb": "2.45",
      "totalSessions": 150,
      "activeSessions": 5,
      "completedSessions": 145,
      "totalStudents": 25,
      "avgScore": 85.3,
      "totalTimeMinutes": 2400
    },
    "scenarioDistribution": [
      {
        "scenario_type": "Medical Scenario",
        "scenario_subtype": "Cardiac Scenario",
        "count": 45,
        "avg_score": 87.2
      }
    ]
  }
}
```

### Student Progress

```bash
GET /api/student/:sunetId/progress
```

**Response**:
```json
{
  "success": true,
  "data": {
    "student": {
      "sunet_id": "student123",
      "name": "John Doe",
      "total_scenarios": 12,
      "completed_scenarios": 10,
      "avg_score": 88.5,
      "total_time_minutes": 180
    },
    "recentSessions": [
      {
        "id": "abc123",
        "scenario_type": "Medical Scenario",
        "scenario_subtype": "Cardiac Scenario",
        "performance_score": 92,
        "completed_at": 1234567890
      }
    ]
  }
}
```

### Leaderboard

```bash
GET /api/leaderboard?limit=10
```

**Response**:
```json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "sunet_id": "student456",
        "name": "Jane Smith",
        "completed": 15,
        "avg_score": 94.2
      }
    ]
  }
}
```

### Export Session

```bash
GET /api/session/:sessionId/export
```

Returns complete session data including all messages and actions (for instructor review).

## How It Works

### Automatic Persistence

```javascript
// Sessions automatically saved every 30 seconds
SessionManager.autoSaveAllSessions();

// On session completion
SessionManager.completeSession(sessionId, {
  score: 85,
  timeElapsed: 900,  // 15 minutes
  actionsCount: 25
});
```

### Session Lifecycle

```
1. Student starts scenario
   ↓
2. Session created in memory
   ↓
3. Auto-saved to database every 30s
   ↓
4. Student completes/abandons
   ↓
5. Final save to database
   ↓
6. Removed from active memory
   ↓
7. Available in database for analytics
```

### On Server Restart

```
1. Server starts
   ↓
2. Database initialized
   ↓
3. Active sessions restored to memory
   ↓
4. Students can continue where they left off
```

## Database File Location

```
/Users/arin/website-work/emt-chatbot/database/emt-scenarios.db
```

## Management Commands

### View Database Stats

```bash
curl http://localhost:3000/api/database/stats
```

### Backup Database

```bash
# Simple file copy
cp database/emt-scenarios.db database/backups/backup-$(date +%Y%m%d).db

# With compression
tar -czf database/backups/backup-$(date +%Y%m%d).tar.gz database/emt-scenarios.db
```

### Restore Database

```bash
# Stop server first!
cp database/backups/backup-20260215.db database/emt-scenarios.db
```

### Clean Old Data

```javascript
const dbManager = require('./database/databaseManager');
await dbManager.initialize();

// Delete sessions older than 30 days
const deleted = dbManager.deleteOldSessions(30);
console.log(`Deleted ${deleted} old sessions`);

// Vacuum to reclaim space
dbManager.vacuum();
```

## Migration to PostgreSQL

When ready for production scaling:

### 1. Install PostgreSQL Client

```bash
npm install pg
```

### 2. Export Data

```bash
sqlite3 database/emt-scenarios.db .dump > dump.sql
```

### 3. Convert Schema

```bash
# Use pgloader or manual conversion
# SQLite → PostgreSQL differences:
# - INTEGER → SERIAL
# - TEXT → VARCHAR
# - Remove "IF NOT EXISTS" for some statements
```

### 4. Update Connection

```javascript
// In databaseManager.js
const { Pool } = require('pg');
this.db = new Pool({
  connectionString: process.env.DATABASE_URL
});
```

### 5. Update Queries

Most queries work as-is, but check:
- `strftime()` → `TO_CHAR()`
- JSON functions may differ
- Placeholder syntax: `?` → `$1, $2`

## Monitoring

### Database Size

```bash
du -h database/emt-scenarios.db
```

### Active Sessions

```bash
curl -s http://localhost:3000/api/sessions/stats | jq '.data.sessionCount'
```

### Top Students

```bash
curl -s http://localhost:3000/api/leaderboard?limit=5 | jq '.data.leaderboard'
```

## Performance Tips

### Index Usage

The schema includes indexes on:
- `sunet_id` (fast student lookups)
- `created_at` (chronological queries)
- `scenario_type` (filtering by type)
- Foreign keys (joins)

### Write-Ahead Logging (WAL)

Enabled by default for better concurrency:

```sql
PRAGMA journal_mode = WAL;
```

### Vacuum Regularly

Reclaim space from deleted records:

```javascript
dbManager.vacuum();  // Run weekly
```

## Troubleshooting

### Database Locked Error

**Problem**: `SQLITE_BUSY: database is locked`

**Solution**:
- Check for long-running queries
- Increase timeout: `db.pragma('busy_timeout = 5000')`
- Use WAL mode (already enabled)

### Database Corrupted

**Problem**: Database file corrupted

**Solution**:
```bash
# Check integrity
sqlite3 database/emt-scenarios.db "PRAGMA integrity_check;"

# If corrupted, restore from backup
cp database/backups/latest.db database/emt-scenarios.db
```

### Slow Queries

**Problem**: Queries taking too long

**Solution**:
```sql
-- Analyze query plan
EXPLAIN QUERY PLAN SELECT * FROM sessions WHERE sunet_id = 'student123';

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_custom ON sessions(custom_column);
```

## Security Considerations

### Data Privacy

- Database contains student PII (SUNet IDs, names)
- Keep database file secure
- Don't commit database to Git (already in `.gitignore`)
- Encrypt database in production

### Backup Strategy

```bash
# Automated daily backups
0 2 * * * /path/to/backup-script.sh

# backup-script.sh
#!/bin/bash
DATE=$(date +%Y%m%d)
cp database/emt-scenarios.db database/backups/backup-$DATE.db
# Delete backups older than 30 days
find database/backups -name "backup-*.db" -mtime +30 -delete
```

## Future Enhancements

- [ ] Real-time analytics dashboard
- [ ] Instructor grading interface
- [ ] Student portfolio export (PDF)
- [ ] Class-wide performance reports
- [ ] Scenario difficulty calibration
- [ ] Peer comparison analytics

## Summary

The database layer provides:
- **Persistence**: Never lose student progress
- **Analytics**: Track improvement over time
- **Oversight**: Instructors can review scenarios
- **Scalability**: Ready for large deployments
- **Compliance**: Full audit trail for accreditation

All while maintaining backward compatibility! 🎓💾
