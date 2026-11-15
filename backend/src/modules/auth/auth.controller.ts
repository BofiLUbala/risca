import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { clientIp, deviceNameFromHeaders } from '../../common/device';
import {
  ActivateDto,
  AdminRegisterDto,
  ChangeAdminKeyDto,
  ChangePasswordDto,
  Enable2faDto,
  InviteDto,
  LoginDto,
  RecoverConfirmDto,
  RecoverStartDto,
  RefreshDto,
  RegisterDonorDto,
  ResendActivationOtpDto,
  ResendVerifyEmailDto,
  VerifyEmailDto,
} from './dto/auth.dto';

@Controller('auth')
@UseGuards(RolesGuard)
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, {
      ip: clientIp(req) ?? undefined,
      userAgent: req.headers['user-agent'] as string,
      deviceName: deviceNameFromHeaders(req.headers) ?? undefined,
    });
  }

  @Public()
  @Post('register-donor')
  registerDonor(@Body() dto: RegisterDonorDto) {
    return this.auth.registerDonor(dto);
  }

  @Public()
  @Get('admin/setup-status')
  adminSetupStatus() {
    return this.auth.adminSetupStatus();
  }

  @Public()
  @Post('admin/register')
  registerAdmin(@Body() dto: AdminRegisterDto) {
    return this.auth.registerAdmin(dto);
  }

  /** La page d'activation demande ce que le lien contient (un Super Admin y choisit aussi sa clé). */
  @Public()
  @Get('activate/info')
  activationInfo(@Query('token') token: string) {
    return this.auth.activationInfo(token);
  }

  /** Récupération du Super Admin n°1 : clé d'installation du serveur + code reçu par e-mail. */
  @Public()
  @Post('admin/recover/start')
  recoverStart(@Body() dto: RecoverStartDto) {
    return this.auth.recoverPrimaryStart(dto);
  }

  @Public()
  @Post('admin/recover/confirm')
  recoverConfirm(@Body() dto: RecoverConfirmDto) {
    return this.auth.recoverPrimaryConfirm(dto);
  }

  @Roles(Role.SUPER_ADMIN)
  @Post('admin/change-key')
  changeAdminKey(@CurrentUser() user: AuthUser, @Body() dto: ChangeAdminKeyDto) {
    return this.auth.changeAdminKey(user, dto);
  }

  /** Super Admin n°1 seulement : identifiants perdus d'un Super Admin n°2 ou n°3. */
  @Roles(Role.SUPER_ADMIN)
  @Post('admin/:id/reset-credentials')
  resetAdminCredentials(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.auth.resetAdminCredentials(id, user);
  }

  @Roles(Role.SUPER_ADMIN)
  @Post('admin/:id/unlock')
  unlockAdmin(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.auth.unlockAdmin(id, user);
  }

  @Public()
  @Post('activate')
  activate(@Body() dto: ActivateDto) {
    return this.auth.activate(dto);
  }

  @Public()
  @Post('activate/resend-otp')
  resendActivationOtp(@Body() dto: ResendActivationOtpDto) {
    return this.auth.resendActivationOtp(dto);
  }

  @Public()
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto);
  }

  @Public()
  @Post('verify-email/resend')
  resendVerifyEmail(@Body() dto: ResendVerifyEmailDto) {
    return this.auth.resendVerifyEmail(dto);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  logout(@CurrentUser() user: AuthUser, @Body() body: { refreshToken?: string }) {
    return this.auth.logout(user.id, body?.refreshToken);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  /** Connectés, durée, appareils, tentatives échouées et comptes bloqués : réservé aux Super Admin. */
  @Roles(Role.SUPER_ADMIN)
  @Get('admin/security')
  securityOverview() {
    return this.auth.securityOverview();
  }

  /** Remises à zéro de la page « Sécurité des accès » : rien n'est effacé du journal d'audit, personne n'est déconnecté. */
  @Roles(Role.SUPER_ADMIN)
  @Delete('admin/security/failed-attempts')
  clearFailedAttempts(@CurrentUser() user: AuthUser) {
    return this.auth.clearFailedAttempts(user);
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete('admin/security/failed-attempts/:id')
  dismissFailedAttempt(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.auth.dismissFailedAttempt(id, user);
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete('admin/security/sessions')
  clearSessionHistory(@CurrentUser() user: AuthUser) {
    return this.auth.clearSessionHistory(user);
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete('admin/security/sessions/:id')
  hideSession(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.auth.hideSession(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.NATIONAL_MANAGER, Role.REGIONAL_MANAGER, Role.ORPHANAGE_DIRECTOR)
  @Post('invite')
  invite(@Body() dto: InviteDto, @CurrentUser() user: AuthUser) {
    return this.auth.invite(dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.NATIONAL_MANAGER, Role.REGIONAL_MANAGER, Role.ORPHANAGE_DIRECTOR)
  @Post('invite/:id/resend')
  resend(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.auth.resendInvitation(id, user);
  }

  @Roles(Role.SUPER_ADMIN)
  @Post('users/:id/force-logout')
  forceLogout(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.auth.forceLogout(id, user);
  }

  @Post('2fa/start')
  start2fa(@CurrentUser() user: AuthUser) {
    return this.auth.start2fa(user.id);
  }

  @Post('2fa/enable')
  enable2fa(@CurrentUser() user: AuthUser, @Body() dto: Enable2faDto) {
    return this.auth.enable2fa(user.id, dto.totp);
  }

  @Post('2fa/disable')
  disable2fa(@CurrentUser() user: AuthUser) {
    return this.auth.disable2fa(user.id);
  }

  @Post('password')
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }
}
