import {
  ALL_MATTER_PERMISSIONS,
  type AuthenticatedPrincipal,
  type CoreTransaction,
  type FirmRole,
  type Matter,
  type MatterPermission,
  type Membership,
  reject,
} from "./contracts.js";
import { isDirectorRole } from "./work-management.js";
// Proposed least privilege policy; must be reconciled with Blueprint before production approval.
export const ROLE_CAPABILITIES: Readonly<
  Record<FirmRole, readonly MatterPermission[]>
> = Object.freeze({
  ADMINISTRATOR: Object.freeze([...ALL_MATTER_PERMISSIONS]),
  COORDINATOR: Object.freeze([...ALL_MATTER_PERMISSIONS]),
  LAWYER: Object.freeze([...ALL_MATTER_PERMISSIONS]),
  ASSISTANT: Object.freeze<MatterPermission[]>([
    "READ",
    "DOCUMENT_WRITE",
    "TASK_WRITE",
    "DRAFT_WRITE",
  ]),
  ADMINISTRATION: Object.freeze<MatterPermission[]>(["READ"]),
});
export class Authorization {
  async director(
    tx: CoreTransaction,
    actor: AuthenticatedPrincipal,
    firmId: string,
  ) {
    const member = await this.membership(tx, actor, firmId);
    if (!isDirectorRole(member.role)) reject("DIRECTOR_REQUIRED");
    return member;
  }
  async assignment(
    tx: CoreTransaction,
    actor: AuthenticatedPrincipal,
    firmId: string,
    identityId: string,
  ) {
    const member = await this.membership(tx, actor, firmId);
    if (
      !isDirectorRole(member.role) &&
      (member.role !== "LAWYER" || identityId !== actor.identity_id)
    )
      reject("DIRECTOR_REQUIRED");
    return member;
  }
  async membership(
    tx: CoreTransaction,
    actor: AuthenticatedPrincipal,
    firmId: string,
    roles?: readonly FirmRole[],
  ): Promise<Membership> {
    const membership = (
      await tx.list("memberships", { law_firm_id: firmId })
    ).find((item) => item.identity_id === actor.identity_id && item.active);
    if (
      !(await tx.get("lawFirms", firmId)) ||
      !membership ||
      (roles && !roles.includes(membership.role))
    )
      reject();
    return membership;
  }
  async participant(
    tx: CoreTransaction,
    identityId: string,
    firmId: string,
    matterId: string,
    permission: MatterPermission,
  ): Promise<void> {
    const membership = (
      await tx.list("memberships", { law_firm_id: firmId })
    ).find((item) => item.identity_id === identityId && item.active);
    const participant = (
      await tx.list("participants", {
        law_firm_id: firmId,
        matter_id: matterId,
      })
    ).find((item) => item.identity_id === identityId && item.active);
    if (membership && isDirectorRole(membership.role)) return;
    if (
      !membership ||
      !ROLE_CAPABILITIES[membership.role].includes(permission) ||
      !participant?.permissions.includes(permission)
    )
      reject();
  }
  async matter(
    tx: CoreTransaction,
    actor: AuthenticatedPrincipal,
    firmId: string,
    matterId: string,
    permission: MatterPermission,
  ): Promise<Matter> {
    await this.membership(tx, actor, firmId);
    const matter = await tx.get("matters", matterId);
    if (!matter || matter.law_firm_id !== firmId) reject();
    await this.participant(tx, actor.identity_id, firmId, matterId, permission);
    return matter;
  }
}
