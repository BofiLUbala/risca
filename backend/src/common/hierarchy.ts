import { Role } from '@prisma/client';

/**
 * Hiérarchie de RISAC (Plan fonctionnel, section 3) : qui peut inviter qui, et qui voit qui.
 * Règle unique : on n'invite et on ne voit que ses subordonnés, jamais son supérieur ni un pair.
 *
 *   Super Admin (n°1 > n°2 = n°3 pour les Super Admin)
 *    ├─ Admin Finance, Modérateur, Auditeur Éthique, Bailleur, Partenaire
 *    └─ Responsable National
 *         └─ Chef Régional
 *              ├─ Ambassadeur, Agent de terrain
 *              └─ Chef d'orphelinat (invité par le Super Admin après validation de l'orphelinat)
 *                   └─ Personnel de l'orphelinat
 */
const ALL: Role[] = Object.values(Role);

/** Rôles qu'un rôle donné peut inviter. */
export const INVITABLE: Partial<Record<Role, Role[]>> = {
  [Role.SUPER_ADMIN]: ALL,
  [Role.NATIONAL_MANAGER]: [Role.REGIONAL_MANAGER, Role.AMBASSADOR, Role.FIELD_AGENT, Role.ORPHANAGE_STAFF],
  [Role.REGIONAL_MANAGER]: [Role.AMBASSADOR, Role.FIELD_AGENT, Role.ORPHANAGE_STAFF],
  [Role.ORPHANAGE_DIRECTOR]: [Role.ORPHANAGE_STAFF],
};

export const canInviteRole = (inviter: Role, target: Role): boolean => !!INVITABLE[inviter]?.includes(target);

/** Rôles qu'un responsable territorial voit dans les listes d'utilisateurs (en plus de lui-même). */
export const VISIBLE_SUBORDINATES: Partial<Record<Role, Role[]>> = {
  [Role.NATIONAL_MANAGER]: [Role.REGIONAL_MANAGER, Role.AMBASSADOR, Role.FIELD_AGENT, Role.ORPHANAGE_DIRECTOR, Role.ORPHANAGE_STAFF],
  [Role.REGIONAL_MANAGER]: [Role.AMBASSADOR, Role.FIELD_AGENT, Role.ORPHANAGE_DIRECTOR, Role.ORPHANAGE_STAFF],
  [Role.ORPHANAGE_DIRECTOR]: [Role.ORPHANAGE_STAFF],
};
