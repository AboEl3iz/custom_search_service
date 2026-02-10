-- Initialize PostgreSQL database with required extensions
-- This script runs automatically when the database is first created

-- Enable pg_trgm extension for fuzzy matching and similarity searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Verify extension is installed
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_trgm';
