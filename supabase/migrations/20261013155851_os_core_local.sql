-- LOCAL DEVELOPMENT ONLY. Generated from packages/persistence-postgres/src/schema.ts.

CREATE SCHEMA IF NOT EXISTS os_private;
REVOKE ALL ON SCHEMA os_private FROM PUBLIC;
DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='os_runtime') THEN CREATE ROLE os_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF; END $$;
GRANT USAGE ON SCHEMA os_private TO os_runtime;
CREATE TABLE IF NOT EXISTS os_private.identities(id text PRIMARY KEY, subject text UNIQUE NOT NULL, display_name text NOT NULL, active boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS os_private.sessions(token_hash text PRIMARY KEY, identity_id text NOT NULL REFERENCES os_private.identities(id), encrypted_tokens text NOT NULL, csrf text NOT NULL, expires_at timestamptz NOT NULL, revoked boolean NOT NULL DEFAULT false);
REVOKE ALL ON os_private.identities,os_private.sessions FROM PUBLIC,os_runtime;
CREATE FUNCTION os_private.actor() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('os.actor',true),'') $$;
CREATE TABLE os_private."lawFirms" (
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 id text GENERATED ALWAYS AS (data->>'id') STORED PRIMARY KEY,
 law_firm_id text GENERATED ALWAYS AS (data->>'id') STORED NOT NULL,
 matter_id text GENERATED ALWAYS AS (data->>'matter_id') STORED,
 revision bigint NOT NULL DEFAULT 1,
 created_by text NOT NULL DEFAULT os_private.actor(),
 created_tx bigint NOT NULL DEFAULT txid_current(),
 UNIQUE(law_firm_id,id), UNIQUE(law_firm_id,matter_id,id)
);
CREATE INDEX "lawFirms_scope" ON os_private."lawFirms"(law_firm_id,matter_id,id);
ALTER TABLE os_private."lawFirms" ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON os_private."lawFirms" TO os_runtime;
CREATE TABLE os_private."memberships" (
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 id text GENERATED ALWAYS AS (data->>'id') STORED PRIMARY KEY,
 law_firm_id text GENERATED ALWAYS AS (data->>'law_firm_id') STORED NOT NULL,
 matter_id text GENERATED ALWAYS AS (data->>'matter_id') STORED,
 revision bigint NOT NULL DEFAULT 1,
 created_by text NOT NULL DEFAULT os_private.actor(),
 created_tx bigint NOT NULL DEFAULT txid_current(),
 UNIQUE(law_firm_id,id), UNIQUE(law_firm_id,matter_id,id)
);
CREATE INDEX "memberships_scope" ON os_private."memberships"(law_firm_id,matter_id,id);
ALTER TABLE os_private."memberships" ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON os_private."memberships" TO os_runtime;
CREATE TABLE os_private."clients" (
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 id text GENERATED ALWAYS AS (data->>'id') STORED PRIMARY KEY,
 law_firm_id text GENERATED ALWAYS AS (data->>'law_firm_id') STORED NOT NULL,
 matter_id text GENERATED ALWAYS AS (data->>'matter_id') STORED,
 revision bigint NOT NULL DEFAULT 1,
 created_by text NOT NULL DEFAULT os_private.actor(),
 created_tx bigint NOT NULL DEFAULT txid_current(),
 UNIQUE(law_firm_id,id), UNIQUE(law_firm_id,matter_id,id)
);
CREATE INDEX "clients_scope" ON os_private."clients"(law_firm_id,matter_id,id);
ALTER TABLE os_private."clients" ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON os_private."clients" TO os_runtime;
CREATE TABLE os_private."contacts" (
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 id text GENERATED ALWAYS AS (data->>'id') STORED PRIMARY KEY,
 law_firm_id text GENERATED ALWAYS AS (data->>'law_firm_id') STORED NOT NULL,
 matter_id text GENERATED ALWAYS AS (data->>'matter_id') STORED,
 revision bigint NOT NULL DEFAULT 1,
 created_by text NOT NULL DEFAULT os_private.actor(),
 created_tx bigint NOT NULL DEFAULT txid_current(),
 UNIQUE(law_firm_id,id), UNIQUE(law_firm_id,matter_id,id)
);
CREATE INDEX "contacts_scope" ON os_private."contacts"(law_firm_id,matter_id,id);
ALTER TABLE os_private."contacts" ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON os_private."contacts" TO os_runtime;
CREATE TABLE os_private."relatedParties" (
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 id text GENERATED ALWAYS AS (data->>'id') STORED PRIMARY KEY,
 law_firm_id text GENERATED ALWAYS AS (data->>'law_firm_id') STORED NOT NULL,
 matter_id text GENERATED ALWAYS AS (data->>'matter_id') STORED,
 revision bigint NOT NULL DEFAULT 1,
 created_by text NOT NULL DEFAULT os_private.actor(),
 created_tx bigint NOT NULL DEFAULT txid_current(),
 UNIQUE(law_firm_id,id), UNIQUE(law_firm_id,matter_id,id)
);
CREATE INDEX "relatedParties_scope" ON os_private."relatedParties"(law_firm_id,matter_id,id);
ALTER TABLE os_private."relatedParties" ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON os_private."relatedParties" TO os_runtime;
CREATE TABLE os_private."matters" (
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 id text GENERATED ALWAYS AS (data->>'id') STORED PRIMARY KEY,
 law_firm_id text GENERATED ALWAYS AS (data->>'law_firm_id') STORED NOT NULL,
 matter_id text GENERATED ALWAYS AS (data->>'matter_id') STORED,
 revision bigint NOT NULL DEFAULT 1,
 created_by text NOT NULL DEFAULT os_private.actor(),
 created_tx bigint NOT NULL DEFAULT txid_current(),
 UNIQUE(law_firm_id,id), UNIQUE(law_firm_id,matter_id,id)
);
CREATE INDEX "matters_scope" ON os_private."matters"(law_firm_id,matter_id,id);
ALTER TABLE os_private."matters" ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON os_private."matters" TO os_runtime;
CREATE TABLE os_private."participants" (
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 id text GENERATED ALWAYS AS (data->>'id') STORED PRIMARY KEY,
 law_firm_id text GENERATED ALWAYS AS (data->>'law_firm_id') STORED NOT NULL,
 matter_id text GENERATED ALWAYS AS (data->>'matter_id') STORED,
 revision bigint NOT NULL DEFAULT 1,
 created_by text NOT NULL DEFAULT os_private.actor(),
 created_tx bigint NOT NULL DEFAULT txid_current(),
 UNIQUE(law_firm_id,id), UNIQUE(law_firm_id,matter_id,id)
);
CREATE INDEX "participants_scope" ON os_private."participants"(law_firm_id,matter_id,id);
ALTER TABLE os_private."participants" ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON os_private."participants" TO os_runtime;
CREATE TABLE os_private."documents" (
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 id text GENERATED ALWAYS AS (data->>'id') STORED PRIMARY KEY,
 law_firm_id text GENERATED ALWAYS AS (data->>'law_firm_id') STORED NOT NULL,
 matter_id text GENERATED ALWAYS AS (data->>'matter_id') STORED,
 revision bigint NOT NULL DEFAULT 1,
 created_by text NOT NULL DEFAULT os_private.actor(),
 created_tx bigint NOT NULL DEFAULT txid_current(),
 UNIQUE(law_firm_id,id), UNIQUE(law_firm_id,matter_id,id)
);
CREATE INDEX "documents_scope" ON os_private."documents"(law_firm_id,matter_id,id);
ALTER TABLE os_private."documents" ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON os_private."documents" TO os_runtime;
CREATE TABLE os_private."documentVersions" (
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 id text GENERATED ALWAYS AS (data->>'id') STORED PRIMARY KEY,
 law_firm_id text GENERATED ALWAYS AS (data->>'law_firm_id') STORED NOT NULL,
 matter_id text GENERATED ALWAYS AS (data->>'matter_id') STORED,
 revision bigint NOT NULL DEFAULT 1,
 created_by text NOT NULL DEFAULT os_private.actor(),
 created_tx bigint NOT NULL DEFAULT txid_current(),
 UNIQUE(law_firm_id,id), UNIQUE(law_firm_id,matter_id,id)
);
CREATE INDEX "documentVersions_scope" ON os_private."documentVersions"(law_firm_id,matter_id,id);
ALTER TABLE os_private."documentVersions" ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON os_private."documentVersions" TO os_runtime;
CREATE TABLE os_private."tasks" (
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 id text GENERATED ALWAYS AS (data->>'id') STORED PRIMARY KEY,
 law_firm_id text GENERATED ALWAYS AS (data->>'law_firm_id') STORED NOT NULL,
 matter_id text GENERATED ALWAYS AS (data->>'matter_id') STORED,
 revision bigint NOT NULL DEFAULT 1,
 created_by text NOT NULL DEFAULT os_private.actor(),
 created_tx bigint NOT NULL DEFAULT txid_current(),
 UNIQUE(law_firm_id,id), UNIQUE(law_firm_id,matter_id,id)
);
CREATE INDEX "tasks_scope" ON os_private."tasks"(law_firm_id,matter_id,id);
ALTER TABLE os_private."tasks" ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON os_private."tasks" TO os_runtime;
CREATE TABLE os_private."drafts" (
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 id text GENERATED ALWAYS AS (data->>'id') STORED PRIMARY KEY,
 law_firm_id text GENERATED ALWAYS AS (data->>'law_firm_id') STORED NOT NULL,
 matter_id text GENERATED ALWAYS AS (data->>'matter_id') STORED,
 revision bigint NOT NULL DEFAULT 1,
 created_by text NOT NULL DEFAULT os_private.actor(),
 created_tx bigint NOT NULL DEFAULT txid_current(),
 UNIQUE(law_firm_id,id), UNIQUE(law_firm_id,matter_id,id)
);
CREATE INDEX "drafts_scope" ON os_private."drafts"(law_firm_id,matter_id,id);
ALTER TABLE os_private."drafts" ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON os_private."drafts" TO os_runtime;
CREATE TABLE os_private."reviews" (
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 id text GENERATED ALWAYS AS (data->>'id') STORED PRIMARY KEY,
 law_firm_id text GENERATED ALWAYS AS (data->>'law_firm_id') STORED NOT NULL,
 matter_id text GENERATED ALWAYS AS (data->>'matter_id') STORED,
 revision bigint NOT NULL DEFAULT 1,
 created_by text NOT NULL DEFAULT os_private.actor(),
 created_tx bigint NOT NULL DEFAULT txid_current(),
 UNIQUE(law_firm_id,id), UNIQUE(law_firm_id,matter_id,id)
);
CREATE INDEX "reviews_scope" ON os_private."reviews"(law_firm_id,matter_id,id);
ALTER TABLE os_private."reviews" ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON os_private."reviews" TO os_runtime;
CREATE TABLE os_private."activities" (
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 id text GENERATED ALWAYS AS (data->>'id') STORED PRIMARY KEY,
 law_firm_id text GENERATED ALWAYS AS (data->>'law_firm_id') STORED NOT NULL,
 matter_id text GENERATED ALWAYS AS (data->>'matter_id') STORED,
 revision bigint NOT NULL DEFAULT 1,
 created_by text NOT NULL DEFAULT os_private.actor(),
 created_tx bigint NOT NULL DEFAULT txid_current(),
 UNIQUE(law_firm_id,id), UNIQUE(law_firm_id,matter_id,id)
);
CREATE INDEX "activities_scope" ON os_private."activities"(law_firm_id,matter_id,id);
ALTER TABLE os_private."activities" ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON os_private."activities" TO os_runtime;
CREATE TABLE os_private."proceedings" (
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 id text GENERATED ALWAYS AS (data->>'id') STORED PRIMARY KEY,
 law_firm_id text GENERATED ALWAYS AS (data->>'law_firm_id') STORED NOT NULL,
 matter_id text GENERATED ALWAYS AS (data->>'matter_id') STORED,
 revision bigint NOT NULL DEFAULT 1,
 created_by text NOT NULL DEFAULT os_private.actor(),
 created_tx bigint NOT NULL DEFAULT txid_current(),
 UNIQUE(law_firm_id,id), UNIQUE(law_firm_id,matter_id,id)
);
CREATE INDEX "proceedings_scope" ON os_private."proceedings"(law_firm_id,matter_id,id);
ALTER TABLE os_private."proceedings" ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON os_private."proceedings" TO os_runtime;
CREATE TABLE os_private."deliveries" (
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 id text GENERATED ALWAYS AS (data->>'id') STORED PRIMARY KEY,
 law_firm_id text GENERATED ALWAYS AS (data->>'law_firm_id') STORED NOT NULL,
 matter_id text GENERATED ALWAYS AS (data->>'matter_id') STORED,
 revision bigint NOT NULL DEFAULT 1,
 created_by text NOT NULL DEFAULT os_private.actor(),
 created_tx bigint NOT NULL DEFAULT txid_current(),
 UNIQUE(law_firm_id,id), UNIQUE(law_firm_id,matter_id,id)
);
CREATE INDEX "deliveries_scope" ON os_private."deliveries"(law_firm_id,matter_id,id);
ALTER TABLE os_private."deliveries" ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON os_private."deliveries" TO os_runtime;
ALTER TABLE os_private."memberships" ADD FOREIGN KEY(law_firm_id) REFERENCES os_private."lawFirms"(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."clients" ADD FOREIGN KEY(law_firm_id) REFERENCES os_private."lawFirms"(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."contacts" ADD FOREIGN KEY(law_firm_id) REFERENCES os_private."lawFirms"(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."relatedParties" ADD FOREIGN KEY(law_firm_id) REFERENCES os_private."lawFirms"(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."matters" ADD FOREIGN KEY(law_firm_id) REFERENCES os_private."lawFirms"(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."participants" ADD FOREIGN KEY(law_firm_id) REFERENCES os_private."lawFirms"(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."documents" ADD FOREIGN KEY(law_firm_id) REFERENCES os_private."lawFirms"(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."documentVersions" ADD FOREIGN KEY(law_firm_id) REFERENCES os_private."lawFirms"(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."tasks" ADD FOREIGN KEY(law_firm_id) REFERENCES os_private."lawFirms"(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."drafts" ADD FOREIGN KEY(law_firm_id) REFERENCES os_private."lawFirms"(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."reviews" ADD FOREIGN KEY(law_firm_id) REFERENCES os_private."lawFirms"(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."activities" ADD FOREIGN KEY(law_firm_id) REFERENCES os_private."lawFirms"(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."proceedings" ADD FOREIGN KEY(law_firm_id) REFERENCES os_private."lawFirms"(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."deliveries" ADD FOREIGN KEY(law_firm_id) REFERENCES os_private."lawFirms"(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."relatedParties" ADD FOREIGN KEY(law_firm_id,matter_id) REFERENCES os_private.matters(law_firm_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."participants" ADD FOREIGN KEY(law_firm_id,matter_id) REFERENCES os_private.matters(law_firm_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."documents" ADD FOREIGN KEY(law_firm_id,matter_id) REFERENCES os_private.matters(law_firm_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."documentVersions" ADD FOREIGN KEY(law_firm_id,matter_id) REFERENCES os_private.matters(law_firm_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."tasks" ADD FOREIGN KEY(law_firm_id,matter_id) REFERENCES os_private.matters(law_firm_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."drafts" ADD FOREIGN KEY(law_firm_id,matter_id) REFERENCES os_private.matters(law_firm_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."reviews" ADD FOREIGN KEY(law_firm_id,matter_id) REFERENCES os_private.matters(law_firm_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."activities" ADD FOREIGN KEY(law_firm_id,matter_id) REFERENCES os_private.matters(law_firm_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."proceedings" ADD FOREIGN KEY(law_firm_id,matter_id) REFERENCES os_private.matters(law_firm_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."deliveries" ADD FOREIGN KEY(law_firm_id,matter_id) REFERENCES os_private.matters(law_firm_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE UNIQUE INDEX membership_identity ON os_private.memberships(law_firm_id,(data->>'identity_id'));
CREATE UNIQUE INDEX participant_identity ON os_private.participants(law_firm_id,matter_id,(data->>'identity_id'));
CREATE FUNCTION os_private.member(firm text, roles text[] DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,os_private AS $$
 SELECT EXISTS(SELECT FROM os_private.memberships m JOIN os_private.identities i ON i.id=m.data->>'identity_id' WHERE m.law_firm_id=firm AND i.id=os_private.actor() AND i.active AND (m.data->>'active')::boolean AND (roles IS NULL OR m.data->>'role'=ANY(roles)))
$$;
CREATE FUNCTION os_private.permitted(firm text, matter text, permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,os_private AS $$
 SELECT os_private.member(firm) AND EXISTS(SELECT FROM os_private.participants p JOIN os_private.memberships m ON m.law_firm_id=p.law_firm_id AND m.data->>'identity_id'=p.data->>'identity_id'
 WHERE p.law_firm_id=firm AND p.matter_id=matter AND p.data->>'identity_id'=os_private.actor() AND (p.data->>'active')::boolean AND p.data->'permissions' ? permission
 AND (m.data->>'role' IN ('ADMINISTRATOR','COORDINATOR','LAWYER') OR (m.data->>'role'='ASSISTANT' AND permission IN ('READ','DOCUMENT_WRITE','TASK_WRITE','DRAFT_WRITE')) OR (m.data->>'role'='ADMINISTRATION' AND permission='READ')))
$$;
CREATE FUNCTION os_private.bootstrap(firm text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,os_private AS $$
 SELECT EXISTS(SELECT FROM os_private."lawFirms" WHERE id=firm AND created_by=os_private.actor() AND created_tx=txid_current())
$$;
CREATE FUNCTION os_private.opening(firm text,matter text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,os_private AS $$
 SELECT os_private.member(firm,ARRAY['ADMINISTRATOR','COORDINATOR','LAWYER']) AND EXISTS(SELECT FROM os_private.matters WHERE id=matter AND law_firm_id=firm AND created_by=os_private.actor() AND created_tx=txid_current())
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA os_private FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA os_private TO os_runtime;
CREATE POLICY firm_read ON os_private."lawFirms" FOR SELECT TO os_runtime USING(os_private.member(id) OR os_private.bootstrap(id));
CREATE POLICY firm_create ON os_private."lawFirms" FOR INSERT TO os_runtime WITH CHECK(os_private.actor() IS NOT NULL);
CREATE POLICY member_read ON os_private.memberships FOR SELECT TO os_runtime USING(os_private.member(law_firm_id) OR os_private.bootstrap(law_firm_id));
CREATE POLICY member_write ON os_private.memberships FOR INSERT TO os_runtime WITH CHECK(os_private.member(law_firm_id,ARRAY['ADMINISTRATOR']) OR (os_private.bootstrap(law_firm_id) AND data->>'identity_id'=os_private.actor() AND data->>'role'='ADMINISTRATOR'));
CREATE POLICY member_update ON os_private.memberships FOR UPDATE TO os_runtime USING(os_private.member(law_firm_id,ARRAY['ADMINISTRATOR'])) WITH CHECK(os_private.member(law_firm_id,ARRAY['ADMINISTRATOR']));
CREATE POLICY directory ON os_private."clients" FOR ALL TO os_runtime USING(os_private.member(law_firm_id,ARRAY['ADMINISTRATOR','COORDINATOR','LAWYER','ASSISTANT'])) WITH CHECK(os_private.member(law_firm_id,ARRAY['ADMINISTRATOR','COORDINATOR','LAWYER','ASSISTANT']));
CREATE POLICY directory ON os_private."contacts" FOR ALL TO os_runtime USING(os_private.member(law_firm_id,ARRAY['ADMINISTRATOR','COORDINATOR','LAWYER','ASSISTANT'])) WITH CHECK(os_private.member(law_firm_id,ARRAY['ADMINISTRATOR','COORDINATOR','LAWYER','ASSISTANT']));
CREATE POLICY matter_read ON os_private.matters FOR SELECT TO os_runtime USING(os_private.permitted(law_firm_id,id,'READ') OR os_private.opening(law_firm_id,id));
CREATE POLICY matter_create ON os_private.matters FOR INSERT TO os_runtime WITH CHECK(os_private.member(law_firm_id,ARRAY['ADMINISTRATOR','COORDINATOR','LAWYER']));
CREATE POLICY matter_update ON os_private.matters FOR UPDATE TO os_runtime USING(os_private.permitted(law_firm_id,id,'MANAGE')) WITH CHECK(os_private.permitted(law_firm_id,id,'MANAGE'));
CREATE POLICY read ON os_private."relatedParties" FOR SELECT TO os_runtime USING((os_private.permitted(law_firm_id,matter_id,'READ') OR os_private.opening(law_firm_id,matter_id)));
 CREATE POLICY insert ON os_private."relatedParties" FOR INSERT TO os_runtime WITH CHECK(os_private.permitted(law_firm_id,matter_id,'MANAGE'));
 CREATE POLICY update ON os_private."relatedParties" FOR UPDATE TO os_runtime USING(os_private.permitted(law_firm_id,matter_id,'MANAGE')) WITH CHECK(os_private.permitted(law_firm_id,matter_id,'MANAGE'));
CREATE POLICY read ON os_private."participants" FOR SELECT TO os_runtime USING((os_private.permitted(law_firm_id,matter_id,'READ') OR os_private.opening(law_firm_id,matter_id)));
 CREATE POLICY insert ON os_private."participants" FOR INSERT TO os_runtime WITH CHECK((os_private.permitted(law_firm_id,matter_id,'MANAGE') OR os_private.opening(law_firm_id,matter_id)));
 CREATE POLICY update ON os_private."participants" FOR UPDATE TO os_runtime USING((os_private.permitted(law_firm_id,matter_id,'MANAGE') OR os_private.opening(law_firm_id,matter_id))) WITH CHECK((os_private.permitted(law_firm_id,matter_id,'MANAGE') OR os_private.opening(law_firm_id,matter_id)));
CREATE POLICY read ON os_private."documents" FOR SELECT TO os_runtime USING((os_private.permitted(law_firm_id,matter_id,'READ') OR os_private.opening(law_firm_id,matter_id)));
 CREATE POLICY insert ON os_private."documents" FOR INSERT TO os_runtime WITH CHECK((os_private.permitted(law_firm_id,matter_id,'DOCUMENT_WRITE') OR os_private.permitted(law_firm_id,matter_id,'DRAFT_WRITE')));
 CREATE POLICY update ON os_private."documents" FOR UPDATE TO os_runtime USING((os_private.permitted(law_firm_id,matter_id,'DOCUMENT_WRITE') OR os_private.permitted(law_firm_id,matter_id,'DRAFT_WRITE'))) WITH CHECK((os_private.permitted(law_firm_id,matter_id,'DOCUMENT_WRITE') OR os_private.permitted(law_firm_id,matter_id,'DRAFT_WRITE')));
CREATE POLICY read ON os_private."documentVersions" FOR SELECT TO os_runtime USING((os_private.permitted(law_firm_id,matter_id,'READ') OR os_private.opening(law_firm_id,matter_id)));
 CREATE POLICY insert ON os_private."documentVersions" FOR INSERT TO os_runtime WITH CHECK((os_private.permitted(law_firm_id,matter_id,'DOCUMENT_WRITE') OR os_private.permitted(law_firm_id,matter_id,'DRAFT_WRITE')));
 REVOKE UPDATE ON os_private."documentVersions" FROM os_runtime;
CREATE POLICY read ON os_private."tasks" FOR SELECT TO os_runtime USING((os_private.permitted(law_firm_id,matter_id,'READ') OR os_private.opening(law_firm_id,matter_id)));
 CREATE POLICY insert ON os_private."tasks" FOR INSERT TO os_runtime WITH CHECK(os_private.permitted(law_firm_id,matter_id,'TASK_WRITE'));
 CREATE POLICY update ON os_private."tasks" FOR UPDATE TO os_runtime USING(os_private.permitted(law_firm_id,matter_id,'TASK_WRITE')) WITH CHECK(os_private.permitted(law_firm_id,matter_id,'TASK_WRITE'));
CREATE POLICY read ON os_private."drafts" FOR SELECT TO os_runtime USING((os_private.permitted(law_firm_id,matter_id,'READ') OR os_private.opening(law_firm_id,matter_id)));
 CREATE POLICY insert ON os_private."drafts" FOR INSERT TO os_runtime WITH CHECK(os_private.permitted(law_firm_id,matter_id,'DRAFT_WRITE'));
 CREATE POLICY update ON os_private."drafts" FOR UPDATE TO os_runtime USING(os_private.permitted(law_firm_id,matter_id,'DRAFT_WRITE')) WITH CHECK(os_private.permitted(law_firm_id,matter_id,'DRAFT_WRITE'));
CREATE POLICY read ON os_private."reviews" FOR SELECT TO os_runtime USING((os_private.permitted(law_firm_id,matter_id,'READ') OR os_private.opening(law_firm_id,matter_id)));
 CREATE POLICY insert ON os_private."reviews" FOR INSERT TO os_runtime WITH CHECK(os_private.permitted(law_firm_id,matter_id,'DRAFT_WRITE'));
 CREATE POLICY update ON os_private."reviews" FOR UPDATE TO os_runtime USING(os_private.permitted(law_firm_id,matter_id,'DRAFT_REVIEW') OR os_private.permitted(law_firm_id,matter_id,'DRAFT_WRITE')) WITH CHECK(os_private.permitted(law_firm_id,matter_id,'DRAFT_REVIEW') OR os_private.permitted(law_firm_id,matter_id,'DRAFT_WRITE'));
CREATE POLICY read ON os_private."activities" FOR SELECT TO os_runtime USING((os_private.permitted(law_firm_id,matter_id,'READ') OR (matter_id IS NULL AND os_private.member(law_firm_id))));
 CREATE POLICY insert ON os_private."activities" FOR INSERT TO os_runtime WITH CHECK((os_private.member(law_firm_id) OR os_private.bootstrap(law_firm_id)));
 REVOKE UPDATE ON os_private."activities" FROM os_runtime;
CREATE POLICY read ON os_private."proceedings" FOR SELECT TO os_runtime USING((os_private.permitted(law_firm_id,matter_id,'READ') OR os_private.opening(law_firm_id,matter_id)));
 CREATE POLICY insert ON os_private."proceedings" FOR INSERT TO os_runtime WITH CHECK(os_private.permitted(law_firm_id,matter_id,'MANAGE'));
 CREATE POLICY update ON os_private."proceedings" FOR UPDATE TO os_runtime USING(os_private.permitted(law_firm_id,matter_id,'MANAGE')) WITH CHECK(os_private.permitted(law_firm_id,matter_id,'MANAGE'));
CREATE POLICY read ON os_private."deliveries" FOR SELECT TO os_runtime USING((os_private.permitted(law_firm_id,matter_id,'READ') OR os_private.opening(law_firm_id,matter_id)));
 CREATE POLICY insert ON os_private."deliveries" FOR INSERT TO os_runtime WITH CHECK(os_private.permitted(law_firm_id,matter_id,'DRAFT_REVIEW'));
 REVOKE UPDATE ON os_private."deliveries" FROM os_runtime;
CREATE TABLE os_private.idempotency(actor text NOT NULL,key text NOT NULL,fingerprint text NOT NULL,result jsonb,PRIMARY KEY(actor,key));
CREATE TABLE os_private.access_audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor text,request_id text NOT NULL,outcome text NOT NULL,created_at timestamptz DEFAULT now());
CREATE TABLE os_private.outbox(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,law_firm_id text NOT NULL,payload jsonb NOT NULL,done_at timestamptz);
GRANT SELECT,INSERT,UPDATE ON os_private.idempotency TO os_runtime;
ALTER TABLE os_private.idempotency ENABLE ROW LEVEL SECURITY;
CREATE POLICY own ON os_private.idempotency TO os_runtime USING(actor=os_private.actor()) WITH CHECK(actor=os_private.actor());
CREATE FUNCTION os_private.emit_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_private AS $$ BEGIN INSERT INTO os_private.outbox(law_firm_id,payload) VALUES(NEW.law_firm_id,jsonb_build_object('event_id',NEW.id,'action',NEW.data->>'action')); RETURN NEW; END $$;
CREATE TRIGGER emit_activity AFTER INSERT ON os_private.activities FOR EACH ROW EXECUTE FUNCTION os_private.emit_activity();
REVOKE ALL ON FUNCTION os_private.emit_activity() FROM PUBLIC,os_runtime;

ALTER TABLE os_private."contacts" ADD COLUMN "client_id" text GENERATED ALWAYS AS (data->>'client_id') STORED NOT NULL;
ALTER TABLE os_private."contacts" ADD FOREIGN KEY(law_firm_id,"client_id") REFERENCES os_private."clients"(law_firm_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX "contacts_client_id_fk" ON os_private."contacts"(law_firm_id,"client_id");
ALTER TABLE os_private."matters" ADD COLUMN "client_id" text GENERATED ALWAYS AS (data->>'client_id') STORED NOT NULL;
ALTER TABLE os_private."matters" ADD FOREIGN KEY(law_firm_id,"client_id") REFERENCES os_private."clients"(law_firm_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX "matters_client_id_fk" ON os_private."matters"(law_firm_id,"client_id");
ALTER TABLE os_private."documentVersions" ADD COLUMN "document_id" text GENERATED ALWAYS AS (data->>'document_id') STORED NOT NULL;
ALTER TABLE os_private."documentVersions" ADD FOREIGN KEY(law_firm_id,"document_id") REFERENCES os_private."documents"(law_firm_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX "documentVersions_document_id_fk" ON os_private."documentVersions"(law_firm_id,"document_id");
ALTER TABLE os_private."drafts" ADD COLUMN "document_id" text GENERATED ALWAYS AS (data->>'document_id') STORED NOT NULL;
ALTER TABLE os_private."drafts" ADD FOREIGN KEY(law_firm_id,"document_id") REFERENCES os_private."documents"(law_firm_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX "drafts_document_id_fk" ON os_private."drafts"(law_firm_id,"document_id");
ALTER TABLE os_private."drafts" ADD COLUMN "document_version_id" text GENERATED ALWAYS AS (data->>'document_version_id') STORED NOT NULL;
ALTER TABLE os_private."drafts" ADD FOREIGN KEY(law_firm_id,"document_version_id") REFERENCES os_private."documentVersions"(law_firm_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX "drafts_document_version_id_fk" ON os_private."drafts"(law_firm_id,"document_version_id");
ALTER TABLE os_private."reviews" ADD COLUMN "draft_id" text GENERATED ALWAYS AS (data->>'draft_id') STORED NOT NULL;
ALTER TABLE os_private."reviews" ADD FOREIGN KEY(law_firm_id,"draft_id") REFERENCES os_private."drafts"(law_firm_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX "reviews_draft_id_fk" ON os_private."reviews"(law_firm_id,"draft_id");
ALTER TABLE os_private."reviews" ADD COLUMN "document_version_id" text GENERATED ALWAYS AS (data->>'document_version_id') STORED NOT NULL;
ALTER TABLE os_private."reviews" ADD FOREIGN KEY(law_firm_id,"document_version_id") REFERENCES os_private."documentVersions"(law_firm_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX "reviews_document_version_id_fk" ON os_private."reviews"(law_firm_id,"document_version_id");
ALTER TABLE os_private."deliveries" ADD COLUMN "document_version_id" text GENERATED ALWAYS AS (data->>'document_version_id') STORED NOT NULL;
ALTER TABLE os_private."deliveries" ADD FOREIGN KEY(law_firm_id,"document_version_id") REFERENCES os_private."documentVersions"(law_firm_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX "deliveries_document_version_id_fk" ON os_private."deliveries"(law_firm_id,"document_version_id");
ALTER TABLE os_private."deliveries" ADD COLUMN "receipt_version_id" text GENERATED ALWAYS AS (data->>'receipt_version_id') STORED NOT NULL;
ALTER TABLE os_private."deliveries" ADD FOREIGN KEY(law_firm_id,"receipt_version_id") REFERENCES os_private."documentVersions"(law_firm_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX "deliveries_receipt_version_id_fk" ON os_private."deliveries"(law_firm_id,"receipt_version_id");
ALTER TABLE os_private."memberships" ADD COLUMN "identity_id" text GENERATED ALWAYS AS (data->>'identity_id') STORED NOT NULL REFERENCES os_private.identities(id);
CREATE INDEX "memberships_identity_id_fk" ON os_private."memberships"("identity_id");
ALTER TABLE os_private."participants" ADD COLUMN "identity_id" text GENERATED ALWAYS AS (data->>'identity_id') STORED NOT NULL REFERENCES os_private.identities(id);
CREATE INDEX "participants_identity_id_fk" ON os_private."participants"("identity_id");
ALTER TABLE os_private."matters" ADD COLUMN "responsible_identity_id" text GENERATED ALWAYS AS (data->>'responsible_identity_id') STORED NOT NULL REFERENCES os_private.identities(id);
CREATE INDEX "matters_responsible_identity_id_fk" ON os_private."matters"("responsible_identity_id");
ALTER TABLE os_private."tasks" ADD COLUMN "responsible_identity_id" text GENERATED ALWAYS AS (data->>'responsible_identity_id') STORED NOT NULL REFERENCES os_private.identities(id);
CREATE INDEX "tasks_responsible_identity_id_fk" ON os_private."tasks"("responsible_identity_id");
ALTER TABLE os_private."drafts" ADD COLUMN "author_identity_id" text GENERATED ALWAYS AS (data->>'author_identity_id') STORED NOT NULL REFERENCES os_private.identities(id);
CREATE INDEX "drafts_author_identity_id_fk" ON os_private."drafts"("author_identity_id");
ALTER TABLE os_private."reviews" ADD COLUMN "reviewer_identity_id" text GENERATED ALWAYS AS (data->>'reviewer_identity_id') STORED NOT NULL REFERENCES os_private.identities(id);
CREATE INDEX "reviews_reviewer_identity_id_fk" ON os_private."reviews"("reviewer_identity_id");
ALTER TABLE os_private."documentVersions" ADD UNIQUE(law_firm_id,matter_id,document_id,id);
ALTER TABLE os_private.documents ADD COLUMN current_version_id text GENERATED ALWAYS AS (data->>'current_version_id') STORED;
ALTER TABLE os_private.documents ADD FOREIGN KEY(law_firm_id,matter_id,id,current_version_id) REFERENCES os_private."documentVersions"(law_firm_id,matter_id,document_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private.memberships ADD CHECK(data->>'role' IN ('ADMINISTRATOR','COORDINATOR','LAWYER','ASSISTANT','ADMINISTRATION'));
ALTER TABLE os_private.memberships ADD UNIQUE(law_firm_id,identity_id);
ALTER TABLE os_private."participants" ADD FOREIGN KEY(law_firm_id,"identity_id") REFERENCES os_private.memberships(law_firm_id,identity_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."matters" ADD FOREIGN KEY(law_firm_id,"responsible_identity_id") REFERENCES os_private.memberships(law_firm_id,identity_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."tasks" ADD FOREIGN KEY(law_firm_id,"responsible_identity_id") REFERENCES os_private.memberships(law_firm_id,identity_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."drafts" ADD FOREIGN KEY(law_firm_id,"author_identity_id") REFERENCES os_private.memberships(law_firm_id,identity_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private."reviews" ADD FOREIGN KEY(law_firm_id,"reviewer_identity_id") REFERENCES os_private.memberships(law_firm_id,identity_id) DEFERRABLE INITIALLY DEFERRED;
CREATE FUNCTION os_private.keep_scope() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.data->>'id' IS DISTINCT FROM OLD.data->>'id' OR NEW.data->>'law_firm_id' IS DISTINCT FROM OLD.data->>'law_firm_id' OR NEW.data->>'matter_id' IS DISTINCT FROM OLD.data->>'matter_id' THEN RAISE EXCEPTION 'IMMUTABLE_SCOPE';END IF;RETURN NEW;END $$;
CREATE TRIGGER keep_scope BEFORE UPDATE ON os_private."lawFirms" FOR EACH ROW EXECUTE FUNCTION os_private.keep_scope();
CREATE TRIGGER keep_scope BEFORE UPDATE ON os_private."memberships" FOR EACH ROW EXECUTE FUNCTION os_private.keep_scope();
CREATE TRIGGER keep_scope BEFORE UPDATE ON os_private."clients" FOR EACH ROW EXECUTE FUNCTION os_private.keep_scope();
CREATE TRIGGER keep_scope BEFORE UPDATE ON os_private."contacts" FOR EACH ROW EXECUTE FUNCTION os_private.keep_scope();
CREATE TRIGGER keep_scope BEFORE UPDATE ON os_private."relatedParties" FOR EACH ROW EXECUTE FUNCTION os_private.keep_scope();
CREATE TRIGGER keep_scope BEFORE UPDATE ON os_private."matters" FOR EACH ROW EXECUTE FUNCTION os_private.keep_scope();
CREATE TRIGGER keep_scope BEFORE UPDATE ON os_private."participants" FOR EACH ROW EXECUTE FUNCTION os_private.keep_scope();
CREATE TRIGGER keep_scope BEFORE UPDATE ON os_private."documents" FOR EACH ROW EXECUTE FUNCTION os_private.keep_scope();
CREATE TRIGGER keep_scope BEFORE UPDATE ON os_private."tasks" FOR EACH ROW EXECUTE FUNCTION os_private.keep_scope();
CREATE TRIGGER keep_scope BEFORE UPDATE ON os_private."drafts" FOR EACH ROW EXECUTE FUNCTION os_private.keep_scope();
CREATE TRIGGER keep_scope BEFORE UPDATE ON os_private."reviews" FOR EACH ROW EXECUTE FUNCTION os_private.keep_scope();
CREATE TRIGGER keep_scope BEFORE UPDATE ON os_private."proceedings" FOR EACH ROW EXECUTE FUNCTION os_private.keep_scope();
CREATE TABLE os_private.approvals(id text PRIMARY KEY,law_firm_id text NOT NULL,matter_id text NOT NULL,version_id text NOT NULL,review_id text NOT NULL UNIQUE,actor text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(law_firm_id,version_id) REFERENCES os_private."documentVersions"(law_firm_id,id));
ALTER TABLE os_private.approvals ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON os_private.approvals TO os_runtime;
CREATE POLICY read ON os_private.approvals TO os_runtime USING(os_private.permitted(law_firm_id,matter_id,'READ'));
CREATE FUNCTION os_private.exact_approval() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_private AS $$
 DECLARE draft jsonb;
 BEGIN IF NEW.data->>'status'='APPROVED' AND OLD.data->>'status'<>'APPROVED' THEN
  SELECT data INTO draft FROM os_private.drafts WHERE id=NEW.data->>'draft_id' AND law_firm_id=NEW.data->>'law_firm_id';
  IF draft IS NULL OR OLD.data->>'status'<>'PENDING' OR draft->>'status'<>'IN_REVIEW' OR draft->>'author_identity_id'=os_private.actor() OR OLD.data->>'reviewer_identity_id'<>os_private.actor() OR NEW.data->>'reviewer_identity_id' IS DISTINCT FROM OLD.data->>'reviewer_identity_id' OR NEW.data->>'document_version_id' IS DISTINCT FROM OLD.data->>'document_version_id' OR NEW.data->>'draft_id' IS DISTINCT FROM OLD.data->>'draft_id' OR draft->>'document_version_id'<>NEW.data->>'document_version_id' OR NOT os_private.permitted(NEW.data->>'law_firm_id',NEW.data->>'matter_id','DRAFT_REVIEW') THEN RAISE EXCEPTION 'INVALID_APPROVAL';END IF;
  INSERT INTO os_private.approvals(id,law_firm_id,matter_id,version_id,review_id,actor) VALUES(NEW.data->>'id',NEW.data->>'law_firm_id',NEW.data->>'matter_id',NEW.data->>'document_version_id',NEW.data->>'id',os_private.actor());
 END IF;RETURN NEW;END $$;
CREATE TRIGGER exact_approval BEFORE UPDATE ON os_private.reviews FOR EACH ROW EXECUTE FUNCTION os_private.exact_approval();
REVOKE ALL ON FUNCTION os_private.exact_approval(),os_private.keep_scope() FROM PUBLIC,os_runtime;
DROP POLICY update ON os_private.drafts;
CREATE POLICY update ON os_private.drafts FOR UPDATE TO os_runtime USING(os_private.permitted(law_firm_id,matter_id,'DRAFT_WRITE') OR os_private.permitted(law_firm_id,matter_id,'DRAFT_REVIEW')) WITH CHECK(os_private.permitted(law_firm_id,matter_id,'DRAFT_WRITE') OR os_private.permitted(law_firm_id,matter_id,'DRAFT_REVIEW'));
DROP POLICY update ON os_private.tasks;
CREATE POLICY update ON os_private.tasks FOR UPDATE TO os_runtime USING(os_private.permitted(law_firm_id,matter_id,'TASK_WRITE') OR (data->>'kind'='DRAFT_REVIEW' AND (os_private.permitted(law_firm_id,matter_id,'DRAFT_REVIEW') OR os_private.permitted(law_firm_id,matter_id,'DRAFT_WRITE')))) WITH CHECK(os_private.permitted(law_firm_id,matter_id,'TASK_WRITE') OR (data->>'kind'='DRAFT_REVIEW' AND (os_private.permitted(law_firm_id,matter_id,'DRAFT_REVIEW') OR os_private.permitted(law_firm_id,matter_id,'DRAFT_WRITE'))));
DROP POLICY insert ON os_private.tasks;
CREATE POLICY insert ON os_private.tasks FOR INSERT TO os_runtime WITH CHECK(os_private.permitted(law_firm_id,matter_id,'TASK_WRITE') OR (data->>'kind'='DRAFT_REVIEW' AND os_private.permitted(law_firm_id,matter_id,'DRAFT_WRITE')));
DROP POLICY insert ON os_private.activities;
CREATE POLICY insert ON os_private.activities FOR INSERT TO os_runtime WITH CHECK(os_private.permitted(law_firm_id,matter_id,'READ') OR (matter_id IS NULL AND (os_private.member(law_firm_id) OR os_private.bootstrap(law_firm_id))));
CREATE FUNCTION os_private.review_only_changes() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (TG_TABLE_NAME='drafts' AND NOT os_private.permitted(OLD.law_firm_id,OLD.matter_id,'DRAFT_WRITE')) OR (TG_TABLE_NAME='tasks' AND NOT os_private.permitted(OLD.law_firm_id,OLD.matter_id,'TASK_WRITE')) THEN
  IF (NEW.data-'status') IS DISTINCT FROM (OLD.data-'status') THEN RAISE EXCEPTION 'REVIEW_STATUS_ONLY'; END IF;
 END IF;RETURN NEW;END $$;
CREATE TRIGGER review_status_only BEFORE UPDATE ON os_private.drafts FOR EACH ROW EXECUTE FUNCTION os_private.review_only_changes();
CREATE TRIGGER review_status_only BEFORE UPDATE ON os_private.tasks FOR EACH ROW EXECUTE FUNCTION os_private.review_only_changes();
REVOKE ALL ON FUNCTION os_private.review_only_changes() FROM PUBLIC,os_runtime;
