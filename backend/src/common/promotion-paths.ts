import { Role } from '@prisma/client';

/**
 * Promotions possibles : rôle actuel → rôles que l'on peut demander. Une promotion monte toujours dans la
 * hiérarchie ; elle exige une lettre du chef régional, validée par un Super Admin (voir PromotionsService).
 * Le rôle visé doit pouvoir s'exercer avec le seul rattachement à une province que le candidat a déjà.
 */
export const PROMOTION_PATHS: Partial<Record<Role, Role[]>> = {
  [Role.FIELD_AGENT]: [Role.AMBASSADOR, Role.REGIONAL_MANAGER],
  [Role.AMBASSADOR]: [Role.REGIONAL_MANAGER],
};

export const canPromote = (from: Role, to: Role): boolean => !!PROMOTION_PATHS[from]?.includes(to);
