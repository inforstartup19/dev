-- Run as a separate migration/DB administrator AFTER alembic upgrade head.
-- Membership in this NOLOGIN role is granted to the actual Azure runtime login.
-- This script creates no password and is not run automatically by the API.
BEGIN;
CREATE ROLE incfs_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO incfs_api;
GRANT SELECT, INSERT ON users TO incfs_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON spaces, space_memberships, teams,
  team_memberships, invitations, projects, submissions, reviews, audit_events TO incfs_api;
GRANT SELECT, INSERT ON project_vaults, vault_events TO incfs_api;
GRANT SELECT, INSERT, DELETE ON vault_memberships TO incfs_api;
GRANT SELECT ON alembic_version TO incfs_api;
GRANT SELECT, INSERT, UPDATE ON idea_drafts TO incfs_api;
GRANT SELECT, INSERT, UPDATE ON knowledge_sources TO incfs_api;
GRANT SELECT, INSERT, UPDATE ON project_experiments TO incfs_api;
GRANT SELECT, INSERT ON experiment_results, experiment_evidence TO incfs_api;
GRANT SELECT, INSERT ON project_decisions, project_resource_intents TO incfs_api;
GRANT SELECT, INSERT, UPDATE ON identity_facets, shareable_needs TO incfs_api;
GRANT SELECT, INSERT, UPDATE ON connect_requests TO incfs_api;
GRANT SELECT, INSERT ON connect_events TO incfs_api;
GRANT SELECT, INSERT, UPDATE ON collaboration_agreements TO incfs_api;
GRANT SELECT, INSERT ON agreement_revisions, agreement_confirmations TO incfs_api;
GRANT SELECT, INSERT ON need_publication_events, need_viewer_grants,
  project_lifecycle_events,
  project_suggestion_feedback TO incfs_api;
GRANT incfs_documents_api TO incfs_api WITH INHERIT TRUE;
COMMIT;
-- Separately: GRANT incfs_api TO "the-runtime-login";
-- Never grant the migration role, schema ownership, CREATE, or BYPASSRLS.
-- PostgreSQL 16+. Worker: GRANT incfs_scanner TO "the-scanner-login" WITH INHERIT TRUE;
-- NEVER grant incfs_scanner to the API login. It can release documents across projects.
