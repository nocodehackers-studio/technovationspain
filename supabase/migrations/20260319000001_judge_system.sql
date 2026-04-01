-- ============================================================
-- Judge Role System (Part 1): Add collaborator enum value
-- Must be in its own migration because ALTER TYPE ADD VALUE
-- cannot be used inside a transaction with statements that
-- reference the new value.
-- ============================================================

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'collaborator';
