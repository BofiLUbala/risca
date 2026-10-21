import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { DonationKind, PaymentProvider, SponsorshipScope } from '@prisma/client';

export class CreateDonationDto {
  @IsEnum(DonationKind) kind: DonationKind;

  @IsNumber() @Min(1) amount: number;

  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() childId?: string;
  @IsOptional() @IsString() projectId?: string;
  @IsOptional() @IsString() message?: string;
  @IsOptional() @IsBoolean() anonymous?: boolean;

  @IsEnum(PaymentProvider) provider: PaymentProvider;
}

export class CreateSponsorshipDto {
  @IsString() childId: string;

  @IsNumber() @Min(1) monthlyAmount: number;

  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsEnum(SponsorshipScope) scope?: SponsorshipScope;

  /** FIXED_MONTHS | UNTIL_18 | END_OF_STUDIES */
  @IsOptional() @IsString() endRule?: string;
  @IsOptional() @IsNumber() months?: number;
  @IsOptional() @IsEnum(PaymentProvider) provider?: PaymentProvider;
}

export class UpdateSponsorshipDto {
  @IsOptional() @IsNumber() @Min(1) monthlyAmount?: number;
  @IsOptional() @IsEnum(SponsorshipScope) scope?: SponsorshipScope;
  @IsOptional() @IsString() endRule?: string;
  @IsOptional() @IsNumber() months?: number;
}

export class WebhookDto {
  @IsString() reference: string;
  @IsString() status: string;
  @IsOptional() @IsString() providerRef?: string;
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsString() signature?: string;
}

export class ManualTransferDto {
  @IsString() donorEmail: string;
  @IsNumber() @Min(1) amount: number;
  @IsOptional() @IsString() currency?: string;
  @IsEnum(DonationKind) kind: DonationKind;
  @IsOptional() @IsString() childId?: string;
  @IsOptional() @IsString() projectId?: string;
  @IsOptional() @IsString() note?: string;
}

export class RefundDto {
  @IsOptional() @IsString() reason?: string;
  /** REFUND (rembourser) ou REALLOCATE (reaffecter au fonds general) */
  @IsOptional() @IsString() mode?: string;
}
