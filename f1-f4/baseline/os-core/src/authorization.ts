import { ALL_MATTER_PERMISSIONS, type AuthenticatedPrincipal, type CoreTransaction, type FirmRole, type Matter, type MatterPermission, type Membership, reject } from './contracts.js';

// Proposed least privilege policy; must be reconciled with Blueprint before production approval.
export const ROLE_CAPABILITIES: Readonly<Record<FirmRole, readonly MatterPermission[]>> = Object.freeze({
  ADMINISTRATOR: Object.freeze([...ALL_MATTER_PERMISSIONS]),
  COORDINATOR: Object.freeze([...ALL_MATTER_PERMISSIONS]),
  LAWYER: Object.freeze([...ALL_MATTER_PERMISSIONS]),
  ASSISTANT: Object.freeze<MatterPermission[]>(['READ', 'DOCUMENT_WRITE', 'TASK_WRITE', 'DRAFT_WRITE']),
  ADMINISTRATION: Object.freeze<MatterPermission[]>(['READ']),
});
export class Authorization {
  membership(tx: CoreTransaction, actor: AuthenticatedPrincipal, firmId: string, roles?: readonly FirmRole[]): Membership {
    const membership = tx.list('memberships', { law_firm_id: firmId }).find(item => item.identity_id === actor.identity_id && item.active);
    if (!tx.get('lawFirms', firmId) || !membership || (roles && !roles.includes(membership.role))) reject();
    return membership;
  }
  participant(tx: CoreTransaction, identityId: string, firmId: string, matterId: string, permission: MatterPermission): void {
    const membership = tx.list('memberships', { law_firm_id: firmId }).find(item => item.identity_id === identityId && item.active);
    const participant = tx.list('participants', { law_firm_id: firmId, matter_id: matterId }).find(item => item.identity_id === identityId && item.active);
    if (!membership || !ROLE_CAPABILITIES[membership.role].includes(permission) || !participant?.permissions.includes(permission)) reject();
  }
  matter(tx: CoreTransaction, actor: AuthenticatedPrincipal, firmId: string, matterId: string, permission: MatterPermission): Matter {
    this.membership(tx, actor, firmId);
    const matter = tx.get('matters', matterId);
    if (!matter || matter.law_firm_id !== firmId) reject();
    this.participant(tx, actor.identity_id, firmId, matterId, permission);
    return matter;
  }
}
