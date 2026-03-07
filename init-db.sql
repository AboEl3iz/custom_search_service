-- ============================================================
-- Initialize PostgreSQL database
-- ============================================================

-- Enable pg_trgm for fuzzy matching and similarity searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- Product table (source of truth)
-- ============================================================
CREATE TABLE IF NOT EXISTS "Product" (
  id          SERIAL PRIMARY KEY,
  title       TEXT    NOT NULL,
  description TEXT,
  brand       TEXT,
  category    TEXT,
  price       NUMERIC(10, 2) DEFAULT 0,
  stock       INTEGER        DEFAULT 0,
  created_at  TIMESTAMPTZ    DEFAULT NOW(),
  updated_at  TIMESTAMPTZ    DEFAULT NOW()
);

-- Required by Debezium to correctly process DELETE events when using the ExtractNewRecordState SMT in "rewrite" mode.
-- It tells PostgreSQL to include the entire row BEFORE it was deleted in the WAL, not just the primary key.
ALTER TABLE "Product" REPLICA IDENTITY FULL;

-- GIN index for fast full-text search on Postgres side
CREATE INDEX IF NOT EXISTS idx_product_fts
  ON "Product" USING GIN (
    (
      setweight(to_tsvector('english', title), 'A') ||
      setweight(to_tsvector('english', coalesce(description, '')), 'B')
    )
  );

-- Trigram index for autocomplete / similarity
CREATE INDEX IF NOT EXISTS idx_product_trgm
  ON "Product" USING GIN (title gin_trgm_ops);

-- ============================================================
-- Logical replication publication for Debezium CDC
-- Debezium reads WAL changes on "Product" and publishes to Kafka.
-- The outbox table and polling pattern have been replaced by this.
-- ============================================================
CREATE PUBLICATION dbz_publication FOR TABLE "Product";
