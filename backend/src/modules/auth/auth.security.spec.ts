import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';

/** Remises à zéro de la page « Sécurité des accès » : rien n'est supprimé, personne n'est déconnecté, tout est tracé. */
describe('AuthService : remises à zéro de « Sécurité des accès »', () => {
  const actor = { id: 'admin-1', email: 'admin@example.org', role: 'SUPER_ADMIN' } as any;
  let prisma: any;
  let audit: { log: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      userSession: { updateMany: jest.fn().mockResolvedValue({ count: 3 }), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
      auditLog: { count: jest.fn().mockResolvedValue(7), findUnique: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
      securityDismissal: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), upsert: jest.fn() },
      refreshToken: { updateMany: jest.fn() },
      user: { update: jest.fn() },
    };
    audit = { log: jest.fn() };
    service = new AuthService(prisma, {} as any, audit as any, {} as any);
  });

  afterEach(() => {
    // Ni suppression dans le journal d'audit ni fermeture de session, quelle que soit l'action.
    expect(prisma.auditLog.delete).not.toHaveBeenCalled();
    expect(prisma.auditLog.deleteMany).not.toHaveBeenCalled();
    expect(prisma.userSession.delete).not.toHaveBeenCalled();
    expect(prisma.userSession.deleteMany).not.toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('vide les tentatives échouées par une date de remise à zéro, journalisée', async () => {
    const res = await service.clearFailedAttempts(actor);
    expect(res).toEqual({ cleared: 7 });
    expect(prisma.securityDismissal.create).toHaveBeenCalledWith({ data: { clearedBefore: expect.any(Date), createdById: 'admin-1' } });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'admin-1', action: 'SECURITY_FAILED_ATTEMPTS_CLEARED', metadata: expect.objectContaining({ count: 7 }) }));
  });

  it('retire une seule tentative échouée et le note au journal', async () => {
    prisma.auditLog.findUnique.mockResolvedValue({ id: 'log-1', action: 'LOGIN_FAILED', metadata: { email: 'test@example.com', reason: 'UNKNOWN_ACCOUNT' }, actorId: null });
    await service.dismissFailedAttempt('log-1', actor);
    expect(prisma.securityDismissal.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { auditLogId: 'log-1' } }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'SECURITY_FAILED_ATTEMPT_DISMISSED', entityId: 'log-1' }));
  });

  it("refuse de retirer une ligne du journal qui n'est pas une tentative de connexion", async () => {
    prisma.auditLog.findUnique.mockResolvedValue({ id: 'log-2', action: 'FORCE_LOGOUT', metadata: {}, actorId: 'x' });
    await expect(service.dismissFailedAttempt('log-2', actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.securityDismissal.upsert).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it("vide l'historique sans toucher aux connexions en cours", async () => {
    const res = await service.clearSessionHistory(actor);
    expect(res).toEqual({ cleared: 3 });
    const { where, data } = prisma.userSession.updateMany.mock.calls[0][0];
    expect(data).toEqual({ hiddenAt: expect.any(Date) });
    expect(data).not.toHaveProperty('endedAt');
    // Seules les connexions terminées ou inactives depuis plus de 5 minutes sont concernées.
    expect(where.OR).toEqual([{ endedAt: { not: null } }, { lastSeenAt: { lt: expect.any(Date) } }]);
    expect(Date.now() - where.OR[1].lastSeenAt.lt.getTime()).toBeGreaterThanOrEqual(5 * 60000 - 1000);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'SECURITY_SESSIONS_CLEARED', metadata: { count: 3 } }));
  });

  it('refuse de retirer une connexion en cours', async () => {
    prisma.userSession.findUnique.mockResolvedValue({ id: 's1', userId: 'u1', endedAt: null, lastSeenAt: new Date(), hiddenAt: null });
    await expect(service.hideSession('s1', actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.userSession.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('retire une connexion terminée et le note au journal', async () => {
    prisma.userSession.findUnique.mockResolvedValue({ id: 's2', userId: 'u1', endedAt: new Date(), lastSeenAt: new Date(), hiddenAt: null });
    await service.hideSession('s2', actor);
    expect(prisma.userSession.update).toHaveBeenCalledWith({ where: { id: 's2' }, data: { hiddenAt: expect.any(Date) } });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'SECURITY_SESSION_HIDDEN', entityType: 'UserSession', entityId: 's2' }));
  });
});
