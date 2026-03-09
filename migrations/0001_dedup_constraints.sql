-- =============================================================
-- Migration: Add deduplication constraints & indexes
-- Fixes: duplicate org memberships, member profiles, KB documents
-- =============================================================

-- 1. org_memberships: prevent same user added to same org twice
-- First, clean up any existing duplicates (keep the earliest record)
DELETE FROM org_memberships
WHERE id NOT IN (
  SELECT MIN(id) FROM org_memberships GROUP BY user_id, org_id
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_memberships_user_org
  ON org_memberships (user_id, org_id);

-- 2. member_profiles: prevent duplicate email per org
-- Clean up duplicate emails first (keep earliest)
DELETE FROM member_profiles
WHERE email IS NOT NULL AND id NOT IN (
  SELECT MIN(id) FROM member_profiles WHERE email IS NOT NULL GROUP BY org_id, email
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_member_profiles_org_email
  ON member_profiles (org_id, email) WHERE email IS NOT NULL;

-- 3. member_profiles: prevent duplicate employee_id per org
DELETE FROM member_profiles
WHERE employee_id IS NOT NULL AND id NOT IN (
  SELECT MIN(id) FROM member_profiles WHERE employee_id IS NOT NULL GROUP BY org_id, employee_id
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_member_profiles_org_empid
  ON member_profiles (org_id, employee_id) WHERE employee_id IS NOT NULL;

-- 4. kb_documents: prevent duplicate content hash per org
DELETE FROM kb_documents
WHERE content_hash IS NOT NULL AND id NOT IN (
  SELECT MIN(id) FROM kb_documents WHERE content_hash IS NOT NULL GROUP BY org_id, content_hash
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kb_docs_org_content_hash
  ON kb_documents (org_id, content_hash) WHERE content_hash IS NOT NULL;
