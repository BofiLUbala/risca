import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Role, StaffFunction } from '@prisma/client';

export class LoginDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caracteres' })
  password: string;

  @IsOptional()
  @IsString()
  totp?: string;

  /** Clé administrateur : exigée pour le Super Admin, en plus du mot de passe. */
  @IsOptional()
  @IsString()
  adminKey?: string;
}

export class InviteDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEnum(Role, { message: 'Rôle inconnu' })
  role: Role;

  @IsOptional()
  @IsString()
  countryId?: string;

  @IsOptional()
  @IsString()
  provinceId?: string;

  @IsOptional()
  @IsString()
  orphanageId?: string;

  @IsOptional()
  @IsEnum(StaffFunction)
  staffFunction?: StaffFunction;

  @IsOptional()
  @IsString()
  managerId?: string;

  @IsOptional()
  @IsString()
  organizationName?: string;
}

export class ActivateDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caracteres' })
  password: string;

  /** Code à 6 chiffres reçu par e-mail. */
  @Matches(/^\d{6}$/, { message: 'Le code de vérification doit contenir 6 chiffres' })
  otp: string;

  /** Super Admin invité : la clé administrateur qu'il choisit lui-même (16 caractères au moins). */
  @IsOptional()
  @IsString()
  adminKey?: string;
}

export class AdminRegisterDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  @MinLength(12, { message: 'Le mot de passe administrateur doit contenir au moins 12 caractères' })
  password: string;

  /** Clé administrateur que le Super Admin choisit lui-même : il la fournira à chaque connexion. */
  @IsString()
  @MinLength(16, { message: 'La clé administrateur doit contenir au moins 16 caractères' })
  adminKey: string;

  /** Durcissement facultatif : clé d'installation du serveur (variable ADMIN_SETUP_KEY), si elle est définie. */
  @IsOptional()
  @IsString()
  setupKey?: string;
}

export class ResendActivationOtpDto {
  @IsString()
  token: string;
}

export class VerifyEmailDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email: string;

  @Matches(/^\d{6}$/, { message: 'Le code de vérification doit contenir 6 chiffres' })
  otp: string;
}

export class ResendVerifyEmailDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email: string;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;
}

export class RegisterDonorDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caracteres' })
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  countryId?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}

export class Enable2faDto {
  @IsString()
  totp: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class SetMaintenanceDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  message?: string;
}

export class ChangeAdminKeyDto {
  @IsString()
  currentPassword: string;

  @IsString()
  currentKey: string;

  @IsString()
  @MinLength(16, { message: 'La nouvelle clé administrateur doit contenir au moins 16 caractères' })
  newKey: string;
}

/** Récupération du Super Admin n°1 : clé d'installation du serveur + code reçu par e-mail. */
export class RecoverStartDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email: string;

  @IsString()
  setupKey: string;
}

export class RecoverConfirmDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email: string;

  @Matches(/^\d{6}$/, { message: 'Le code de vérification doit contenir 6 chiffres' })
  otp: string;

  @IsString()
  setupKey: string;

  @IsString()
  @MinLength(12, { message: 'Le mot de passe administrateur doit contenir au moins 12 caractères' })
  password: string;

  @IsString()
  @MinLength(16, { message: 'La clé administrateur doit contenir au moins 16 caractères' })
  adminKey: string;
}
