/** Local schema source. Never applies to a remote database. Business tables are NOT exposed to PostgREST. */
import { directorAccessSql } from "./director-policy.js";
const tables = [
  "lawFirms",
  "memberships",
  "clients",
  "contacts",
  "relatedParties",
  "matters",
  "participants",
  "documents",
  "documentVersions",
  "tasks",
  "drafts",
  "reviews",
  "activities",
  "proceedings",
  "deliveries",
] as const;
export const schemaSql = `
CREATE SCHEMA IF NOT EXISTS os_private;
REVOKE ALL ON SCHEMA os_private FROM PUBLIC;
DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='os_runtime') THEN CREATE ROLE os_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF; END $$;
GRANT USAGE ON SCHEMA os_private TO os_runtime;
CREATE TABLE IF NOT EXISTS os_private.identities(id text PRIMARY KEY, subject text UNIQUE NOT NULL, display_name text NOT NULL, active boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS os_private.sessions(token_hash text PRIMARY KEY, identity_id text NOT NULL REFERENCES os_private.identities(id), encrypted_tokens text NOT NULL, csrf text NOT NULL, expires_at timestamptz NOT NULL, revoked boolean NOT NULL DEFAULT false);
REVOKE ALL ON os_private.identities,os_private.sessions FROM PUBLIC,os_runtime;
CREATE FUNCTION os_private.actor() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('os.actor',true),'') $$;
${tables
  .map(
    (t) => `CREATE TABLE os_private."${t}" (
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 id text GENERATED ALWAYS AS (data->>'id') STORED PRIMARY KEY,
 law_firm_id text GENERATED ALWAYS AS (${t === "lawFirms" ? "data->>'id'" : "data->>'law_firm_id'"}) STORED NOT NULL,
 matter_id text GENERATED ALWAYS AS (data->>'matter_id') STORED,
 revision bigint NOT NULL DEFAULT 1,
 created_by text NOT NULL DEFAULT os_private.actor(),
 created_tx bigint NOT NULL DEFAULT txid_current(),
 UNIQUE(law_firm_id,id), UNIQUE(law_firm_id,matter_id,id)
);
CREATE INDEX "${t}_scope" ON os_private."${t}"(law_firm_id,matter_id,id);
ALTER TABLE os_private."${t}" ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON os_private."${t}" TO os_runtime;`,
  )
  .join("\n")}
${tables
  .filter((t) => t !== "lawFirms")
  .map(
    (t) =>
      `ALTER TABLE os_private."${t}" ADD FOREIGN KEY(law_firm_id) REFERENCES os_private."lawFirms"(id) DEFERRABLE INITIALLY DEFERRED;`,
  )
  .join("\n")}
${["relatedParties", "participants", "documents", "documentVersions", "tasks", "drafts", "reviews", "activities", "proceedings", "deliveries"].map((t) => `ALTER TABLE os_private."${t}" ADD FOREIGN KEY(law_firm_id,matter_id) REFERENCES os_private.matters(law_firm_id,id) DEFERRABLE INITIALLY DEFERRED;`).join("\n")}
CREATE UNIQUE INDEX membership_identity ON os_private.memberships(law_firm_id,(data->>'identity_id'));
CREATE UNIQUE INDEX participant_identity ON os_private.participants(law_firm_id,matter_id,(data->>'identity_id'));
CREATE FUNCTION os_private.member(firm text, roles text[] DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,os_private AS $$
 SELECT EXISTS(SELECT FROM os_private.memberships m JOIN os_private.identities i ON i.id=m.data->>'identity_id' WHERE m.law_firm_id=firm AND i.id=os_private.actor() AND i.active AND (m.data->>'active')::boolean AND (roles IS NULL OR m.data->>'role'=ANY(roles)))
$$;
${directorAccessSql}
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
${["clients", "contacts"].map((t) => `CREATE POLICY directory ON os_private."${t}" FOR ALL TO os_runtime USING(os_private.member(law_firm_id,ARRAY['ADMINISTRATOR','COORDINATOR','LAWYER','ASSISTANT'])) WITH CHECK(os_private.member(law_firm_id,ARRAY['ADMINISTRATOR','COORDINATOR','LAWYER','ASSISTANT']));`).join("\n")}
CREATE POLICY matter_read ON os_private.matters FOR SELECT TO os_runtime USING(os_private.permitted(law_firm_id,id,'READ') OR os_private.opening(law_firm_id,id));
CREATE POLICY matter_create ON os_private.matters FOR INSERT TO os_runtime WITH CHECK(os_private.member(law_firm_id,ARRAY['ADMINISTRATOR','COORDINATOR','LAWYER']));
CREATE POLICY matter_update ON os_private.matters FOR UPDATE TO os_runtime USING(os_private.permitted(law_firm_id,id,'MANAGE')) WITH CHECK(os_private.permitted(law_firm_id,id,'MANAGE'));
${tables
  .filter(
    (t) =>
      !["lawFirms", "memberships", "clients", "contacts", "matters"].includes(
        t,
      ),
  )
  .map((t) => {
    const permission = (
      {
        participants: "MANAGE",
        documents: "DOCUMENT_WRITE",
        documentVersions: "DOCUMENT_WRITE",
        tasks: "TASK_WRITE",
        drafts: "DRAFT_WRITE",
        reviews: "DRAFT_WRITE",
        relatedParties: "MANAGE",
        proceedings: "MANAGE",
        deliveries: "DRAFT_REVIEW",
        activities: "READ",
      } as Record<string, string>
    )[t];
    const clause =
      t === "participants"
        ? `(os_private.permitted(law_firm_id,matter_id,'MANAGE') OR os_private.opening(law_firm_id,matter_id))`
        : t === "activities"
          ? `(os_private.member(law_firm_id) OR os_private.bootstrap(law_firm_id))`
          : `os_private.permitted(law_firm_id,matter_id,'${permission}')`;
    const read =
      t === "activities"
        ? `(os_private.permitted(law_firm_id,matter_id,'READ') OR (matter_id IS NULL AND os_private.member(law_firm_id)))`
        : `(os_private.permitted(law_firm_id,matter_id,'READ') OR os_private.opening(law_firm_id,matter_id))`;
    const write =
      t === "documents" || t === "documentVersions"
        ? `(${clause} OR os_private.permitted(law_firm_id,matter_id,'DRAFT_WRITE'))`
        : clause;
    return `CREATE POLICY read ON os_private."${t}" FOR SELECT TO os_runtime USING(${read});
 CREATE POLICY insert ON os_private."${t}" FOR INSERT TO os_runtime WITH CHECK(${write});
 ${["documentVersions", "activities", "deliveries"].includes(t) ? `REVOKE UPDATE ON os_private."${t}" FROM os_runtime;` : `CREATE POLICY update ON os_private."${t}" FOR UPDATE TO os_runtime USING(${t === "reviews" ? `os_private.permitted(law_firm_id,matter_id,'DRAFT_REVIEW') OR os_private.permitted(law_firm_id,matter_id,'DRAFT_WRITE')` : write}) WITH CHECK(${t === "reviews" ? `os_private.permitted(law_firm_id,matter_id,'DRAFT_REVIEW') OR os_private.permitted(law_firm_id,matter_id,'DRAFT_WRITE')` : write});`}`;
  })
  .join("\n")}
CREATE TABLE os_private.idempotency(actor text NOT NULL,key text NOT NULL,fingerprint text NOT NULL,result jsonb,PRIMARY KEY(actor,key));
CREATE TABLE os_private.access_audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor text,request_id text NOT NULL,outcome text NOT NULL,created_at timestamptz DEFAULT now());
CREATE TABLE os_private.outbox(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,law_firm_id text NOT NULL,payload jsonb NOT NULL,done_at timestamptz);
GRANT SELECT,INSERT,UPDATE ON os_private.idempotency TO os_runtime;
ALTER TABLE os_private.idempotency ENABLE ROW LEVEL SECURITY;
CREATE POLICY own ON os_private.idempotency TO os_runtime USING(actor=os_private.actor()) WITH CHECK(actor=os_private.actor());
CREATE FUNCTION os_private.emit_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_private AS $$ BEGIN INSERT INTO os_private.outbox(law_firm_id,payload) VALUES(NEW.law_firm_id,jsonb_build_object('event_id',NEW.id,'action',NEW.data->>'action')); RETURN NEW; END $$;
CREATE TRIGGER emit_activity AFTER INSERT ON os_private.activities FOR EACH ROW EXECUTE FUNCTION os_private.emit_activity();
REVOKE ALL ON FUNCTION os_private.emit_activity() FROM PUBLIC,os_runtime;
`;
export const constraintsSql = `
${[
  ["contacts", "client_id", "clients"],
  ["matters", "client_id", "clients"],
  ["documentVersions", "document_id", "documents"],
  ["drafts", "document_id", "documents"],
  ["drafts", "document_version_id", "documentVersions"],
  ["reviews", "draft_id", "drafts"],
  ["reviews", "document_version_id", "documentVersions"],
  ["deliveries", "document_version_id", "documentVersions"],
  ["deliveries", "receipt_version_id", "documentVersions"],
]
  .map(
    ([
      t,
      field,
      target,
    ]) => `ALTER TABLE os_private."${t}" ADD COLUMN "${field}" text GENERATED ALWAYS AS (data->>'${field}') STORED NOT NULL;
ALTER TABLE os_private."${t}" ADD FOREIGN KEY(law_firm_id,"${field}") REFERENCES os_private."${target}"(law_firm_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX "${t}_${field}_fk" ON os_private."${t}"(law_firm_id,"${field}");`,
  )
  .join("\n")}
${[
  ["memberships", "identity_id"],
  ["participants", "identity_id"],
  ["matters", "responsible_identity_id"],
  ["tasks", "responsible_identity_id"],
  ["drafts", "author_identity_id"],
  ["reviews", "reviewer_identity_id"],
]
  .map(
    ([
      t,
      field,
    ]) => `ALTER TABLE os_private."${t}" ADD COLUMN "${field}" text GENERATED ALWAYS AS (data->>'${field}') STORED NOT NULL REFERENCES os_private.identities(id);
CREATE INDEX "${t}_${field}_fk" ON os_private."${t}"("${field}");`,
  )
  .join("\n")}
ALTER TABLE os_private."documentVersions" ADD UNIQUE(law_firm_id,matter_id,document_id,id);
ALTER TABLE os_private.documents ADD COLUMN current_version_id text GENERATED ALWAYS AS (data->>'current_version_id') STORED;
ALTER TABLE os_private.documents ADD FOREIGN KEY(law_firm_id,matter_id,id,current_version_id) REFERENCES os_private."documentVersions"(law_firm_id,matter_id,document_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE os_private.memberships ADD CHECK(data->>'role' IN ('ADMINISTRATOR','COORDINATOR','LAWYER','ASSISTANT','ADMINISTRATION'));
ALTER TABLE os_private.memberships ADD UNIQUE(law_firm_id,identity_id);
${[
  ["participants", "identity_id"],
  ["matters", "responsible_identity_id"],
  ["tasks", "responsible_identity_id"],
  ["drafts", "author_identity_id"],
  ["reviews", "reviewer_identity_id"],
]
  .map(
    ([t, field]) =>
      `ALTER TABLE os_private."${t}" ADD FOREIGN KEY(law_firm_id,"${field}") REFERENCES os_private.memberships(law_firm_id,identity_id) DEFERRABLE INITIALLY DEFERRED;`,
  )
  .join("\n")}
CREATE FUNCTION os_private.keep_scope() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.data->>'id' IS DISTINCT FROM OLD.data->>'id' OR NEW.data->>'law_firm_id' IS DISTINCT FROM OLD.data->>'law_firm_id' OR NEW.data->>'matter_id' IS DISTINCT FROM OLD.data->>'matter_id' THEN RAISE EXCEPTION 'IMMUTABLE_SCOPE';END IF;RETURN NEW;END $$;
${tables
  .filter((t) => !["documentVersions", "activities", "deliveries"].includes(t))
  .map(
    (t) =>
      `CREATE TRIGGER keep_scope BEFORE UPDATE ON os_private."${t}" FOR EACH ROW EXECUTE FUNCTION os_private.keep_scope();`,
  )
  .join("\n")}
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
`;
