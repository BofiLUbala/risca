import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { PaymentStatus, Role } from '@prisma/client';
import { Response } from 'express';
import { PaymentsService } from './payments.service';
import { ReceiptsService } from './receipts.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateDonationDto,
  CreateSponsorshipDto,
  ManualTransferDto,
  RefundDto,
  UpdateSponsorshipDto,
  WebhookDto,
} from './dto/payment.dto';

@Controller('payments')
@UseGuards(RolesGuard)
export class PaymentsController {
  constructor(
    private payments: PaymentsService,
    private receipts: ReceiptsService,
  ) {}

  /** Frais affiches avant le paiement. */
  @Public()
  @Get('quote')
  quote(@Query('amount') amount: string, @Query('currency') currency?: string) {
    return this.payments.quote(Number(amount), currency ?? 'USD');
  }

  @Get('methods')
  methods(@CurrentUser() user: AuthUser) {
    return this.payments.methodsFor(user);
  }

  /** Confirmation du fournisseur de paiement. */
  @Public()
  @Post('webhook')
  webhook(@Body() dto: WebhookDto) {
    return this.payments.handleWebhook(dto);
  }

  // ------------------------------------------------------------- dons

  @Roles(Role.DONOR, Role.PARTNER, Role.SUPER_ADMIN)
  @Post('donations')
  createDonation(@Body() dto: CreateDonationDto, @CurrentUser() user: AuthUser) {
    return this.payments.createDonation(dto, user);
  }

  @Get('donations/mine')
  myDonations(@CurrentUser() user: AuthUser) {
    return this.payments.myDonations(user);
  }

  @Get('impact')
  impact(@CurrentUser() user: AuthUser) {
    return this.payments.myImpact(user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN_FINANCE, Role.ETHICS_AUDITOR)
  @Get('donations')
  allDonations(
    @Query('status') status?: PaymentStatus,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.payments.allDonations({ status, take: Number(take ?? 50), skip: Number(skip ?? 0) });
  }

  @Get('donations/:id')
  donation(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.payments.donation(id, user);
  }

  @Get('donations/:id/receipt')
  async receipt(@Param('id') id: string, @CurrentUser() user: AuthUser, @Res() res: Response) {
    await this.payments.donation(id, user);
    const pdf = await this.receipts.generate(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="recu-${id}.pdf"`);
    res.send(pdf);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN_FINANCE)
  @Post('donations/manual-transfer')
  manualTransfer(@Body() dto: ManualTransferDto, @CurrentUser() user: AuthUser) {
    return this.payments.recordManualTransfer(dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN_FINANCE)
  @Post('donations/:id/refund')
  refund(@Param('id') id: string, @Body() dto: RefundDto, @CurrentUser() user: AuthUser) {
    return this.payments.refund(id, dto.mode ?? 'REFUND', dto.reason, user);
  }

  @Post('donations/:id/withdraw')
  withdraw(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.payments.withdrawFromProject(id, user);
  }

  // ------------------------------------------------------------- parrainages

  @Roles(Role.DONOR, Role.PARTNER, Role.SUPER_ADMIN)
  @Post('sponsorships')
  createSponsorship(@Body() dto: CreateSponsorshipDto, @CurrentUser() user: AuthUser) {
    return this.payments.createSponsorship(dto, user);
  }

  @Get('sponsorships/mine')
  mySponsorships(@CurrentUser() user: AuthUser) {
    return this.payments.mySponsorships(user);
  }

  @Patch('sponsorships/:id')
  updateSponsorship(
    @Param('id') id: string,
    @Body() dto: UpdateSponsorshipDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.updateSponsorship(id, dto, user);
  }

  @Post('sponsorships/:id/pause')
  pause(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.payments.pauseSponsorship(id, user);
  }

  @Post('sponsorships/:id/resume')
  resume(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.payments.resumeSponsorship(id, user);
  }

  @Post('sponsorships/:id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.payments.cancelSponsorship(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN_FINANCE)
  @Post('sponsorships/run-charges')
  runCharges() {
    return this.payments.runRecurringCharges();
  }
}
