-- Run once BEFORE deploying the hardened backend. Preserves all existing data.
-- Compatible with MySQL 8; rerunning does not reset session versions.
SET @siimex_add_session_version = IF(
    EXISTS(SELECT 1 FROM information_schema.columns
           WHERE table_schema = DATABASE() AND table_name = 'auth_users'
             AND column_name = 'session_version'),
    'SELECT 1',
    'ALTER TABLE auth_users ADD COLUMN session_version BIGINT NOT NULL DEFAULT 0');
PREPARE siimex_security_migration FROM @siimex_add_session_version;
EXECUTE siimex_security_migration;
DEALLOCATE PREPARE siimex_security_migration;
