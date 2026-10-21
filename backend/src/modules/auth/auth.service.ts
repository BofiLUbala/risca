import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { MailerService } from '../../common/services/mailer.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  ActivateDto,
  AdminRegisterDto,
  InviteDto,
  LoginDto,
  RegisterDonorDto,
  ResendActivationOtpDto,
  ResendVerifyEmailDto,
  VerifyEmailDto,
} from './dto/auth.dto';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const INVITATION_TTL_HOURS = 72;

// Code à usage unique d'activation, remis par e-mail.
const OTP_TTL_MINUTES = 15;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

type OtpTarget = { id: string; email: string; firstName: string };
type OtpDelivery = { emailSent: boolean; devOtp?: string };

/** Roles qui doivent obligatoirement activer la double authentification (section 12). */
const ADMIN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN_FINANCE, Role.MODERATOR, Role.ETHICS_AUDITOR];

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
    private mailer: MailerService,
  ) {}

  private hashOtp(userId: string, otp: string): string {
    return crypto
      .createHmac('sha256', process.env.JWT_SECRET ?? 'risac-otp')
      .update(`${userId}:${otp}`)
      .digest('hex');
  }

  /**
   * Génère un code à 6 chiffres, le stocke haché (jamais en clair) puis l'envoie par e-mail.
   * Le code n'est renvoyé à l'appelant qu'en mode de test explicite (MAIL_ECHO_OTP).
   */
  private async issueActivationOtp(
    user: OtpTarget,
    purpose: 'ACTIVATION' | 'VERIFY_EMAIL',
    activationUrl?: string,
  ): Promise<OtpDelivery> {
    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        activationOtpHash: this.hashOtp(user.id, otp),
        activationOtpExpiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60000),
        activationOtpAttempts: 0,
        activationOtpSentAt: new Date(),
      },
    });

    const mail = await this.mailer.sendOtp({
      to: user.email,
      firstName: user.firstName,
      otp,
      ttlMinutes: OTP_TTL_MINUTES,
      activationUrl,
      purpose,
    });
    return { emailSent: mail.sent, ...(mail.echoed ? { devOtp: otp } : {}) };
  }

  /** Refuse un renvoi trop rapproché pour ne pas servir de relais d'envoi en masse. */
  private assertOtpCooldown(sentAt: Date | null) {
    if (sentAt && Date.now() - sentAt.getTime() < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
      throw new HttpException(
        `Patientez ${OTP_RESEND_COOLDOWN_SECONDS} secondes avant de demander un nouveau code`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async assertOtpValid(
    user: {
      id: string;
      activationOtpHash: string | null;
      activationOtpExpiresAt: Date | null;
      activationOtpAttempts: number;
    },
    otp: string,
  ) {
    if (!user.activationOtpHash || !user.activationOtpExpiresAt) {
      throw new BadRequestException('Aucun code en cours, demandez un nouvel envoi');
    }
    if (user.activationOtpExpiresAt < new Date()) {
      throw new BadRequestException('Le code a expiré, demandez un nouvel envoi');
    }
    if (user.activationOtpAttempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Trop de tentatives, demandez un nouveau code');
    }

    const expected = Buffer.from(user.activationOtpHash);
    const given = Buffer.from(this.hashOtp(user.id, otp));
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
      const attempts = user.activationOtpAttempts + 1;
      await this.prisma.user.update({ where: { id: user.id }, data: { activationOtpAttempts: attempts } });
      const left = OTP_MAX_ATTEMPTS - attempts;
      throw new BadRequestException(
        left > 0 ? `Code incorrect, ${left} essai(s) restant(s)` : 'Trop de tentatives, demandez un nouveau code',
      );
    }
  }

  private async issueTokens(
    user: { id: string; email: string; role: Role; tokenVersion: number },
    userAgent?: string,
  ) {
    const payload = { sub: user.id, email: user.email, role: user.role, tv: user.tokenVersion };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: (process.env.JWT_EXPIRES_IN || '30m') as any,
    });

    const refreshToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const days = parseInt((process.env.JWT_REFRESH_EXPIRES_IN || '30d').replace('d', ''), 10) || 30;

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        userAgent: userAgent ?? null,
      },
    });

    return { accessToken, refreshToken };
  }

  async login(dto: LoginDto, meta: { ip?: string; userAgent?: string } = {}) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });

    if (!user || !user.passwordHash) {
      await this.audit.log({
        action: 'LOGIN_FAILED',
        entityType: 'User',
        metadata: { email: dto.email, reason: 'UNKNOWN_ACCOUNT' },
        ip: meta.ip,
      });
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Compte temporairement verrouille, reessayez plus tard');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password).catch(() => false);

    if (!valid) {
      const failed = user.failedLoginCount + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failed,
          lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
        },
      });
      await this.audit.log({
        actorId: user.id,
        actorRole: user.role,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        metadata: { attempt: failed },
        ip: meta.ip,
      });
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (user.status === UserStatus.INVITED) {
      throw new ForbiddenException(
        user.role === Role.DONOR || user.role === Role.SUPER_ADMIN
          ? 'Adresse e-mail non confirmée : saisissez le code reçu par e-mail'
          : 'Compte non activé, utilisez le lien et le code reçus par e-mail',
      );
    }
    if (user.status === UserStatus.BLOCKED) throw new ForbiddenException('Compte bloque');
    if (user.status === UserStatus.SUSPENDED) throw new ForbiddenException('Compte suspendu');
    if (user.status === UserStatus.FROZEN) throw new ForbiddenException('Compte gele par la gouvernance');

    // Le Super Admin présente, en plus du mot de passe, la clé qu'il a choisie à la création du compte.
    if (user.role === Role.SUPER_ADMIN && user.adminKeyHash) {
      const given = this.cleanKey(dto.adminKey);
      if (!given) return { adminKeyRequired: true };
      const keyOk = await argon2.verify(user.adminKeyHash, given).catch(() => false);
      if (!keyOk) {
        const failed = user.failedLoginCount + 1;
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: failed,
            lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
          },
        });
        await this.audit.log({
          actorId: user.id,
          actorRole: user.role,
          action: 'LOGIN_FAILED',
          entityType: 'User',
          entityId: user.id,
          metadata: { attempt: failed, reason: 'BAD_ADMIN_KEY' },
          ip: meta.ip,
        });
        throw new UnauthorizedException('Identifiants invalides');
      }
    }

    if (user.twoFactorEnabled) {
      if (!dto.totp) {
        return { twoFactorRequired: true };
      }
      const ok = authenticator.verify({ token: dto.totp, secret: user.twoFactorSecret });
      if (!ok) throw new UnauthorizedException('Code de double authentification invalide');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokens(user, meta.userAgent);

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { ...tokens, user: await this.me(user.id) };
  }

  async invite(dto: InviteDto, inviter: AuthUser) {
    if (dto.role === Role.SUPER_ADMIN) {
      throw new BadRequestException('Il ne peut y avoir qu’un seul Super Admin');
    }
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Un compte existe déjà avec cette adresse');

    if (dto.role === Role.ORPHANAGE_DIRECTOR && !dto.orphanageId) {
      throw new BadRequestException('Un chef d’orphelinat doit être rattaché à un orphelinat');
    }
    if (dto.role === Role.ORPHANAGE_STAFF && (!dto.orphanageId || !dto.staffFunction)) {
      throw new BadRequestException('Le personnel doit avoir un orphelinat et une fonction');
    }
    if (dto.role === Role.NATIONAL_MANAGER && !dto.countryId) {
      throw new BadRequestException('Un responsable national doit avoir un pays');
    }
    if ((dto.role === Role.REGIONAL_MANAGER || dto.role === Role.FIELD_AGENT) && !dto.provinceId) {
      throw new BadRequestException('Ce rôle doit être rattaché à une province');
    }

    const token = crypto.randomBytes(32).toString('hex');

    const user = await this.prisma.user.create({
      data: {
        email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        status: UserStatus.INVITED,
        countryId: dto.countryId ?? null,
        provinceId: dto.provinceId ?? null,
        orphanageId: dto.orphanageId ?? null,
        staffFunction: dto.staffFunction ?? null,
        managerId: dto.managerId ?? inviter.id,
        organizationName: dto.organizationName ?? null,
        invitationToken: token,
        invitationExpiresAt: new Date(Date.now() + INVITATION_TTL_HOURS * 3600000),
        invitedById: inviter.id,
      },
    });

    await this.audit.log({
      actorId: inviter.id,
      actorRole: inviter.role,
      action: 'USER_INVITED',
      entityType: 'User',
      entityId: user.id,
      metadata: { role: dto.role, email },
    });

    const activationUrl = `${process.env.APP_WEB_URL}/activate?token=${token}`;
    const delivery = await this.issueActivationOtp(user, 'ACTIVATION', activationUrl);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      activationUrl,
      expiresAt: user.invitationExpiresAt,
      ...delivery,
    };
  }

  async resendInvitation(userId: string, actor: AuthUser) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.status !== UserStatus.INVITED) throw new BadRequestException('Ce compte est déjà activé');

    const token = crypto.randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        invitationToken: token,
        invitationExpiresAt: new Date(Date.now() + INVITATION_TTL_HOURS * 3600000),
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'INVITATION_RESENT',
      entityType: 'User',
      entityId: userId,
    });

    const activationUrl = `${process.env.APP_WEB_URL}/activate?token=${token}`;
    const delivery = await this.issueActivationOtp(user, 'ACTIVATION', activationUrl);
    return { activationUrl, ...delivery };
  }

  /** Renvoie un nouveau code à partir du lien d'activation (page d'activation, sans connexion). */
  async resendActivationOtp(dto: ResendActivationOtpDto) {
    const user = await this.prisma.user.findUnique({ where: { invitationToken: dto.token } });
    if (!user || user.status !== UserStatus.INVITED) throw new BadRequestException('Lien d’activation invalide');
    if (!user.invitationExpiresAt || user.invitationExpiresAt < new Date()) {
      throw new BadRequestException('Lien d’activation expiré, demandez un nouvel envoi');
    }
    this.assertOtpCooldown(user.activationOtpSentAt);
    return this.issueActivationOtp(
      user,
      'ACTIVATION',
      `${process.env.APP_WEB_URL}/activate?token=${dto.token}`,
    );
  }

  async activate(dto: ActivateDto) {
    const user = await this.prisma.user.findUnique({ where: { invitationToken: dto.token } });
    if (!user) throw new BadRequestException('Lien d’activation invalide');
    if (!user.invitationExpiresAt || user.invitationExpiresAt < new Date()) {
      throw new BadRequestException('Lien d’activation expire, demandez un nouvel envoi');
    }
    await this.assertOtpValid(user, dto.otp);

    const passwordHash = await argon2.hash(dto.password);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        status: UserStatus.ACTIVE,
        invitationToken: null,
        invitationExpiresAt: null,
        activationOtpHash: null,
        activationOtpExpiresAt: null,
        activationOtpAttempts: 0,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'ACCOUNT_ACTIVATED',
      entityType: 'User',
      entityId: user.id,
    });

    const tokens = await this.issueTokens(updated);
    return {
      ...tokens,
      user: await this.me(user.id),
      twoFactorRequired: ADMIN_ROLES.includes(user.role),
    };
  }

  /** Compare deux secrets en temps constant, sans révéler leur longueur. */
  private sameSecret(given: string | undefined, expected: string): boolean {
    const a = crypto.createHash('sha256').update(given ?? '').digest();
    const b = crypto.createHash('sha256').update(expected).digest();
    return crypto.timingSafeEqual(a, b);
  }

  /** Une clé collée avec des espaces ou des guillemets ne doit pas devenir invalide pour autant. */
  private cleanKey(value: string | undefined): string {
    return (value ?? '').trim().replace(/^["']+|["']+$/g, '').trim();
  }

  /**
   * État de l'installation, public, sans aucun secret.
   * - creationOpen : aucun Super Admin n'existe, OU l'unique Super Admin n'a pas encore choisi sa
   *   clé (compte de démonstration du jeu de données) : il peut alors être repris une seule fois.
   * - installKeyRequired : une clé d'installation de serveur (facultative) est exigée.
   * Dès que le Super Admin a choisi sa clé, la création est fermée définitivement.
   */
  async adminSetupStatus() {
    const admins = await this.prisma.user.findMany({
      where: { role: Role.SUPER_ADMIN },
      select: { id: true, adminKeyHash: true, status: true },
    });
    const adminExists = admins.length > 0;
    // Reprenable tant que le propriétaire n'a pas confirmé son e-mail (ou n'a pas encore de clé).
    const claimable =
      admins.length === 1 && (!admins[0].adminKeyHash || admins[0].status === UserStatus.INVITED);
    const creationOpen = !adminExists || claimable;
    return {
      adminExists,
      creationOpen,
      claimable,
      installKeyRequired: creationOpen && !!process.env.ADMIN_SETUP_KEY?.trim(),
    };
  }

  /**
   * Création du compte de l'unique Super Admin, par lui-même, avec la clé qu'il choisit.
   * - Aucun Super Admin : le compte est créé.
   * - Un Super Admin sans clé (compte de démonstration) : ce compte est repris, avec son historique.
   * - Un Super Admin avec clé : refus, il ne peut y en avoir qu'un seul.
   */
  async registerAdmin(dto: AdminRegisterDto) {
    const status = await this.adminSetupStatus();
    if (!status.creationOpen) {
      throw new ForbiddenException('Un Super Admin existe déjà : il ne peut y en avoir qu’un seul');
    }

    const installKey = process.env.ADMIN_SETUP_KEY?.trim();
    if (installKey && !this.sameSecret(this.cleanKey(dto.setupKey), installKey)) {
      await this.audit.log({
        action: 'ADMIN_REGISTER_REFUSED',
        entityType: 'User',
        metadata: { email: dto.email },
      });
      throw new ForbiddenException('Clé d’installation incorrecte');
    }

    const adminKey = this.cleanKey(dto.adminKey);
    if (adminKey.length < 16) {
      throw new BadRequestException('La clé administrateur doit contenir au moins 16 caractères');
    }

    const email = dto.email.toLowerCase();
    const passwordHash = await argon2.hash(dto.password);
    const adminKeyHash = await argon2.hash(adminKey);
    const other = await this.prisma.user.findUnique({ where: { email } });

    let user;
    if (status.claimable) {
      const existing = await this.prisma.user.findFirstOrThrow({ where: { role: Role.SUPER_ADMIN } });
      if (other && other.id !== existing.id) {
        throw new BadRequestException('Un compte existe déjà avec cette adresse');
      }
      user = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          passwordHash,
          adminKeyHash,
          // L'adresse du nouveau propriétaire doit être confirmée ; les anciennes sessions sont fermées.
          status: UserStatus.INVITED,
          tokenVersion: { increment: 1 },
          // Le nouveau propriétaire doit, lui aussi, activer les notifications avant d'entrer.
          pushExempt: false,
          failedLoginCount: 0,
          lockedUntil: null,
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      });
      await this.prisma.refreshToken.deleteMany({ where: { userId: existing.id } });
    } else {
      if (other) throw new BadRequestException('Un compte existe déjà avec cette adresse');
      try {
        user = await this.prisma.user.create({
          data: {
            email,
            passwordHash,
            adminKeyHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
            role: Role.SUPER_ADMIN,
            // Actif seulement après confirmation de l'adresse par le code reçu.
            status: UserStatus.INVITED,
          },
        });
      } catch (e: any) {
        // L'index « un seul Super Admin » a refusé : une autre requête a gagné la course.
        if (e?.code === 'P2002') {
          throw new ForbiddenException('Un Super Admin existe déjà : il ne peut y en avoir qu’un seul');
        }
        throw e;
      }
    }

    await this.audit.log({
      actorId: user.id,
      actorRole: Role.SUPER_ADMIN,
      action: status.claimable ? 'ADMIN_CLAIMED' : 'ADMIN_REGISTERED',
      entityType: 'User',
      entityId: user.id,
    });

    const delivery = await this.issueActivationOtp(user, 'VERIFY_EMAIL');
    return { pendingVerification: true, email: user.email, ...delivery };
  }

  async registerDonor(dto: RegisterDonorDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Un compte existe déjà avec cette adresse');

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await argon2.hash(dto.password),
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: Role.DONOR,
        // Le compte n'est actif qu'après confirmation de l'adresse par le code reçu.
        status: UserStatus.INVITED,
        countryId: dto.countryId ?? null,
        locale: dto.locale ?? 'fr',
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: Role.DONOR,
      action: 'DONOR_REGISTERED',
      entityType: 'User',
      entityId: user.id,
    });

    const delivery = await this.issueActivationOtp(user, 'VERIFY_EMAIL');
    return { pendingVerification: true, email: user.email, ...delivery };
  }

  /** Confirme l'adresse d'un bailleur inscrit : code correct => compte actif et connexion. */
  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    const selfRegistered = user?.role === Role.DONOR || user?.role === Role.SUPER_ADMIN;
    if (!user || user.status !== UserStatus.INVITED || !selfRegistered || !user.passwordHash) {
      throw new BadRequestException('Code invalide ou expiré');
    }
    await this.assertOtpValid(user, dto.otp);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: UserStatus.ACTIVE,
        activationOtpHash: null,
        activationOtpExpiresAt: null,
        activationOtpAttempts: 0,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'ACCOUNT_ACTIVATED',
      entityType: 'User',
      entityId: user.id,
      metadata: { via: 'EMAIL_OTP' },
    });

    const tokens = await this.issueTokens(updated);
    return {
      ...tokens,
      user: await this.me(user.id),
      twoFactorRequired: ADMIN_ROLES.includes(user.role),
    };
  }

  /** Réponse identique que l'adresse existe ou non, pour ne pas révéler les comptes. */
  async resendVerifyEmail(dto: ResendVerifyEmailDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    const selfRegistered = user?.role === Role.DONOR || user?.role === Role.SUPER_ADMIN;
    if (user && user.status === UserStatus.INVITED && selfRegistered && user.passwordHash) {
      this.assertOtpCooldown(user.activationOtpSentAt);
      await this.issueActivationOtp(user, 'VERIFY_EMAIL');
    }
    return { ok: true };
  }

  async refresh(refreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!row || row.revokedAt || row.expiresAt < new Date()) {
      throw new UnauthorizedException('Jeton de rafraichissement invalide');
    }

    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    const tokens = await this.issueTokens(row.user, row.userAgent ?? undefined);
    return { ...tokens, user: await this.me(row.userId) };
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, userId },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { success: true };
  }

  /** Forcer la deconnexion d un utilisateur (Super Admin, section 11). */
  async forceLogout(userId: string, actor: AuthUser) {
    await this.prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'FORCE_LOGOUT',
      entityType: 'User',
      entityId: userId,
    });
    return { success: true };
  }

  async start2fa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });
    const otpauth = authenticator.keyuri(user.email, 'RISAC', secret);
    return { secret, otpauth };
  }

  async enable2fa(userId: string, totp: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user.twoFactorSecret) throw new BadRequestException('Commencez par generer un secret');
    if (!authenticator.verify({ token: totp, secret: user.twoFactorSecret })) {
      throw new BadRequestException('Code invalide');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
    await this.audit.log({
      actorId: userId,
      actorRole: user.role,
      action: '2FA_ENABLED',
      entityType: 'User',
      entityId: userId,
    });
    return { enabled: true };
  }

  async disable2fa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (ADMIN_ROLES.includes(user.role)) {
      throw new ForbiddenException('La double authentification est obligatoire pour ce rôle');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    return { enabled: false };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const ok = await argon2.verify(user.passwordHash, currentPassword).catch(() => false);
    if (!ok) throw new BadRequestException('Mot de passe actuel incorrect');

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(newPassword), tokenVersion: { increment: 1 } },
    });
    await this.audit.log({
      actorId: userId,
      actorRole: user.role,
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: userId,
    });
    return { success: true };
  }

  async me(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        avatarUrl: true,
        locale: true,
        staffFunction: true,
        twoFactorEnabled: true,
        pushExempt: true,
        organizationName: true,
        lastLoginAt: true,
        country: { select: { id: true, iso2: true, nameFr: true, nameEn: true, currency: true } },
        province: { select: { id: true, code: true, nameFr: true, nameEn: true } },
        orphanage: { select: { id: true, name: true, slug: true, labelStatus: true } },
      },
    });
  }
}
