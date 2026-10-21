import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  ActivateDto,
  AdminRegisterDto,
  ChangePasswordDto,
  Enable2faDto,
  InviteDto,
  LoginDto,
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
    return this.auth.login(dto, { ip: req.ip, userAgent: req.headers['user-agent'] as string });
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
