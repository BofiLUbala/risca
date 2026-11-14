import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  countryId?: string | null;
  provinceId?: string | null;
  orphanageId?: string | null;
  staffFunction?: string | null;
  status: string;
  /** Rang du Super Admin (1 = principal, 2 et 3 = secondaires) ; absent pour les autres rôles. */
  adminRank?: number | null;
}

export const CurrentUser = createParamDecorator((data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return data ? request.user?.[data] : request.user;
});
