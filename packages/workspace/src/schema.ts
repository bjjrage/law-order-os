/** Additive local migration. Existing Core tables and records are preserved. */
export const workspaceSql = `
CREATE TABLE IF NOT EXISTS os_private.workspace_documents (
 id uuid PRIMARY KEY, law_firm_id text NOT NULL, matter_id text NOT NULL,
 document_id text NOT NULL, draft_id text NOT NULL, source_version_id text NOT NULL,
 checkpoint_version_id text NOT NULL, y_state bytea NOT NULL, y_vector bytea NOT NULL,
 rich_json jsonb NOT NULL, state_hash text NOT NULL, revision bigint NOT NULL DEFAULT 1,
 updated_by text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(law_firm_id,matter_id,document_id),
 FOREIGN KEY(law_firm_id,matter_id,document_id) REFERENCES os_private.documents(law_firm_id,matter_id,id),
 FOREIGN KEY(law_firm_id,matter_id,draft_id) REFERENCES os_private.drafts(law_firm_id,matter_id,id)
);
CREATE TABLE IF NOT EXISTS os_private.workspace_updates (
 room_id uuid NOT NULL REFERENCES os_private.workspace_documents(id), revision bigint NOT NULL,
 actor_id text NOT NULL, update_hash text NOT NULL, state_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(room_id,revision)
);
CREATE TABLE IF NOT EXISTS os_private.workspace_checkpoints (
 room_id uuid NOT NULL REFERENCES os_private.workspace_documents(id), version_id text NOT NULL,
 command_id uuid NOT NULL, y_state bytea NOT NULL, rich_json jsonb NOT NULL, state_hash text NOT NULL,
 actor_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(room_id,version_id), UNIQUE(room_id,command_id)
);
CREATE TABLE IF NOT EXISTS os_private.workspace_grants (
 token_hash text PRIMARY KEY, room_id uuid NOT NULL REFERENCES os_private.workspace_documents(id),
 actor_id text NOT NULL, read_only boolean NOT NULL, revoked boolean NOT NULL DEFAULT false,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON os_private.workspace_documents,os_private.workspace_updates,os_private.workspace_checkpoints,os_private.workspace_grants FROM PUBLIC;
CREATE TABLE IF NOT EXISTS os_private.workspace_jobs (
 id uuid PRIMARY KEY, room_id uuid NOT NULL REFERENCES os_private.workspace_documents(id), actor_id text NOT NULL,
 fingerprint text NOT NULL, request jsonb NOT NULL, context jsonb NOT NULL, status text NOT NULL,
 result jsonb, error_code text, reserved_usd numeric NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS os_private.workspace_comments (
 id uuid PRIMARY KEY, room_id uuid NOT NULL REFERENCES os_private.workspace_documents(id), actor_id text NOT NULL,
 base_hash text NOT NULL, quote text NOT NULL, body text NOT NULL, range_from integer NOT NULL, range_to integer NOT NULL,
 resolved boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS os_private.workspace_review_decisions (
 room_id uuid NOT NULL REFERENCES os_private.workspace_documents(id),
 job_id uuid NOT NULL REFERENCES os_private.workspace_jobs(id), finding_index integer NOT NULL,
 actor_id text NOT NULL, status text NOT NULL CHECK(status IN ('OPEN','LINKED','APPLIED','DISMISSED')),
 quote text NOT NULL, range_from integer NOT NULL, range_to integer NOT NULL, state_hash text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(room_id,job_id,finding_index)
);
ALTER TABLE os_private.workspace_review_decisions ADD COLUMN IF NOT EXISTS anchor_hash text;
REVOKE ALL ON os_private.workspace_review_decisions FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON os_private.workspace_review_decisions TO os_runtime;
ALTER TABLE os_private.workspace_review_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON os_private.workspace_jobs,os_private.workspace_comments FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON os_private.workspace_jobs,os_private.workspace_comments TO os_runtime;
ALTER TABLE os_private.workspace_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_private.workspace_comments ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['workspace_jobs','workspace_comments','workspace_review_decisions'] LOOP
 IF NOT EXISTS(SELECT FROM pg_policies WHERE schemaname='os_private' AND tablename=t AND policyname='workspace_note_read') THEN
 EXECUTE format('CREATE POLICY workspace_note_read ON os_private.%I FOR SELECT TO os_runtime USING(EXISTS(SELECT 1 FROM os_private.workspace_documents d WHERE d.id=room_id))',t);
 EXECUTE format('CREATE POLICY workspace_note_write ON os_private.%I FOR INSERT TO os_runtime WITH CHECK(actor_id=os_private.actor() AND EXISTS(SELECT 1 FROM os_private.workspace_documents d WHERE d.id=room_id AND os_private.permitted(d.law_firm_id,d.matter_id,''DRAFT_WRITE'')))',t);
 EXECUTE format('CREATE POLICY workspace_note_update ON os_private.%I FOR UPDATE TO os_runtime USING(EXISTS(SELECT 1 FROM os_private.workspace_documents d WHERE d.id=room_id AND os_private.permitted(d.law_firm_id,d.matter_id,''DRAFT_WRITE''))) WITH CHECK(EXISTS(SELECT 1 FROM os_private.workspace_documents d WHERE d.id=room_id AND os_private.permitted(d.law_firm_id,d.matter_id,''DRAFT_WRITE'')))',t);
 END IF; END LOOP; END $$;
GRANT SELECT,INSERT,UPDATE ON os_private.workspace_documents TO os_runtime;
GRANT SELECT,INSERT ON os_private.workspace_updates,os_private.workspace_checkpoints TO os_runtime;
GRANT SELECT ON os_private.workspace_grants TO os_runtime;
ALTER TABLE os_private.workspace_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_private.workspace_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_private.workspace_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_private.workspace_checkpoints ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_policies WHERE schemaname='os_private' AND tablename='workspace_grants' AND policyname='workspace_grant_read') THEN
 CREATE POLICY workspace_grant_read ON os_private.workspace_grants FOR SELECT TO os_runtime USING(actor_id=os_private.actor() AND EXISTS(SELECT 1 FROM os_private.workspace_documents d WHERE d.id=room_id));
 END IF;
 IF NOT EXISTS(SELECT FROM pg_policies WHERE schemaname='os_private' AND tablename='workspace_documents' AND policyname='workspace_read') THEN
 CREATE POLICY workspace_read ON os_private.workspace_documents FOR SELECT TO os_runtime USING(os_private.permitted(law_firm_id,matter_id,'READ'));
 CREATE POLICY workspace_insert ON os_private.workspace_documents FOR INSERT TO os_runtime WITH CHECK(os_private.permitted(law_firm_id,matter_id,'DRAFT_WRITE'));
 CREATE POLICY workspace_write ON os_private.workspace_documents FOR UPDATE TO os_runtime USING(os_private.permitted(law_firm_id,matter_id,'DRAFT_WRITE')) WITH CHECK(os_private.permitted(law_firm_id,matter_id,'DRAFT_WRITE'));
 END IF;
END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['workspace_updates','workspace_checkpoints'] LOOP
 IF NOT EXISTS(SELECT FROM pg_policies WHERE schemaname='os_private' AND tablename=t AND policyname='workspace_child_read') THEN
 EXECUTE format('CREATE POLICY workspace_child_read ON os_private.%I FOR SELECT TO os_runtime USING(EXISTS(SELECT 1 FROM os_private.workspace_documents d WHERE d.id=room_id))',t);
 EXECUTE format('CREATE POLICY workspace_child_write ON os_private.%I FOR INSERT TO os_runtime WITH CHECK(EXISTS(SELECT 1 FROM os_private.workspace_documents d WHERE d.id=room_id AND os_private.permitted(d.law_firm_id,d.matter_id,''DRAFT_WRITE'')))',t);
 END IF;
 END LOOP; END $$;
CREATE OR REPLACE FUNCTION os_private.workspace_independent_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d jsonb; BEGIN
 SELECT data INTO d FROM os_private.drafts WHERE id=NEW.data->>'draft_id' AND law_firm_id=NEW.data->>'law_firm_id' AND matter_id=NEW.data->>'matter_id';
 IF (NEW.data->>'status') IN ('PENDING','APPROVED','CHANGES_REQUESTED') AND coalesce(d->'coauthor_identity_ids','[]'::jsonb) ? (NEW.data->>'reviewer_identity_id') THEN RAISE EXCEPTION 'SELF_REVIEW_FORBIDDEN'; END IF;
 RETURN NEW; END $$;
REVOKE ALL ON FUNCTION os_private.workspace_independent_review() FROM PUBLIC,os_runtime;
DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_trigger WHERE tgname='workspace_independent_review' AND tgrelid='os_private.reviews'::regclass) THEN
CREATE TRIGGER workspace_independent_review BEFORE INSERT OR UPDATE ON os_private.reviews FOR EACH ROW EXECUTE FUNCTION os_private.workspace_independent_review();
END IF; END $$;
`;
