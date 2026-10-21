import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { LabelStatus } from '@prisma/client';

export class CreateOrphanageDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsString()
  countryId: string;

  @IsString()
  provinceId: string;

  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() commune?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsString() legalStatus?: string;
  @IsOptional() @IsString() licenseNumber?: string;
  @IsOptional() @IsInt() @Min(0) totalPlaces?: number;
  @IsOptional() @IsInt() @Min(0) occupiedPlaces?: number;
}

export class UpdateOrphanageDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() commune?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() urgentNeeds?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsBoolean() hideExactLocation?: boolean;
  @IsOptional() @IsString() legalStatus?: string;
  @IsOptional() @IsString() licenseNumber?: string;
  @IsOptional() @IsInt() @Min(0) totalPlaces?: number;
  @IsOptional() @IsInt() @Min(0) occupiedPlaces?: number;
  @IsOptional() @IsBoolean() hasDormitory?: boolean;
  @IsOptional() @IsBoolean() hasDrinkingWater?: boolean;
  @IsOptional() @IsBoolean() hasElectricity?: boolean;
  @IsOptional() @IsBoolean() hasSchool?: boolean;
  @IsOptional() @IsBoolean() hasInfirmary?: boolean;
  @IsOptional() @IsString() bankAccountName?: string;
  @IsOptional() @IsString() bankAccountNumber?: string;
  @IsOptional() @IsString() mobileMoneyNumber?: string;
  @IsOptional() @IsString() mobileMoneyProvider?: string;
}

export class LabelDecisionDto {
  @IsEnum(LabelStatus)
  result: LabelStatus;

  @IsOptional() @IsString() conditions?: string;
  @IsOptional() @IsInt() score?: number;
  @IsOptional() @IsString() notes?: string;
}

export class LinkAmbassadorDto {
  @IsString() ambassadorId: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class OrphanageHistoryDto {
  @IsString() kind: string;
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
}
