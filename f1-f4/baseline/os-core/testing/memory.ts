import { CoreError, type AuthenticatedPrincipal, type Authenticator, type CorePersistence, type CoreTables, type CoreTransaction, type Identity, type MutableTable, type TableName } from '../src/contracts.js';

type State = { [K in TableName]: Map<string, CoreTables[K]> };
const TABLES: TableName[] = ['lawFirms', 'memberships', 'clients', 'contacts', 'relatedParties', 'matters', 'participants', 'documents', 'documentVersions', 'tasks', 'drafts', 'reviews', 'activities'];
function emptyState(): State { return Object.fromEntries(TABLES.map(name => [name, new Map()])) as State; }

/** TESTED_OFFLINE ONLY. Volatile, no durable session, no database, no enterprise storage claim. */
export class MemoryTestPersistence implements CorePersistence {
  readonly assurance = 'TESTED_OFFLINE' as const;
  private state = emptyState();
  private queue: Promise<void> = Promise.resolve();
  async transaction<T>(operation: (transaction: CoreTransaction) => T | Promise<T>): Promise<T> {
    const prior = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>(resolve => { release = resolve; });
    await prior;
    const candidate: State = structuredClone(this.state);
    const tx: CoreTransaction = {
      get<K extends TableName>(table: K, identity: string): CoreTables[K] | undefined { return structuredClone(candidate[table].get(identity)); },
      list<K extends Exclude<TableName, 'lawFirms'>>(table: K, scope: { law_firm_id: string; matter_id?: string }): CoreTables[K][] {
        return structuredClone([...candidate[table].values()].filter(item => item.law_firm_id === scope.law_firm_id && (scope.matter_id === undefined || ('matter_id' in item && item.matter_id === scope.matter_id))));
      },
      insert<K extends TableName>(table: K, record: CoreTables[K]): void {
        if (candidate[table].has(record.id)) throw new CoreError('DUPLICATE_ID');
        candidate[table].set(record.id, structuredClone(record));
      },
      replace<K extends MutableTable>(table: K, record: CoreTables[K]): void {
        if (table as string === 'documentVersions' || table as string === 'activities') throw new CoreError('IMMUTABLE_RECORD');
        if (!candidate[table].has(record.id)) throw new CoreError('MISSING_RECORD');
        candidate[table].set(record.id, structuredClone(record));
      },
    };
    try {
      const result = await operation(tx);
      const safeResult = structuredClone(result);
      this.state = candidate;
      return safeResult;
    } finally { release(); }
  }
}

/** TESTED_OFFLINE ONLY. The token map is a test double, not authentication for a running app. */
export class TestAuthenticator implements Authenticator {
  private identities = new Map<string, Identity>();
  private tokens = new Map<string, AuthenticatedPrincipal>();
  register(identity: Identity, token: string, expiresAt = '2099-01-01T00:00:00.000Z'): void {
    this.identities.set(identity.id, structuredClone(identity));
    this.tokens.set(token, { identity_id: identity.id, subject: identity.subject, session_id: `session:${identity.id}`, expires_at: expiresAt });
  }
  deactivate(identityId: string): void { const prior = this.identities.get(identityId); if (prior) this.identities.set(identityId, { ...prior, active: false }); }
  revoke(token: string): void { this.tokens.delete(token); }
  async authenticate(credential: string): Promise<AuthenticatedPrincipal | null> { return structuredClone(this.tokens.get(credential) ?? null); }
  async identity(identityId: string): Promise<Identity | null> { return structuredClone(this.identities.get(identityId) ?? null); }
}
