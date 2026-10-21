import {
  IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, MinLength,
} from 'class-validator';
import { ChildStatus, TimelineType, Visibility } from '@prisma/client';

export class CreateChildDto {
  @IsString() @MinLength(2) firstName: string;
  @IsString() @MinLength(2) lastName: string;
  @IsString() sex: string;

  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsInt() estimatedAge?: number;
  @IsOptional() @IsString() orphanageId?: string;
  @IsOptional() @IsArray() languages?: string[];

  @IsOptional() @IsBoolean() warOrphan?: boolean;
  @IsOptional() @IsBoolean() displaced?: boolean;
  @IsOptional() @IsBoolean() abandoned?: boolean;
  @IsOptional() @IsBoolean() streetChild?: boolean;
  @IsOptional() @IsBoolean() formerArmedGroup?: boolean;

  @IsOptional() @IsDateString() admittedAt?: string;
  @IsOptional() @IsString() admissionReason?: string;
  @IsOptional() @IsString() referredBy?: string;

  @IsOptional() @IsString() publicStory?: string;
  @IsOptional() @IsString() publicNeeds?: string;
  @IsOptional() @IsString() lifeProject?: string;
  @IsOptional() @IsString() talents?: string;
  @IsOptional() @IsString() desiredJob?: string;

  /** Champs dynamiques definis par le modele du pays. */
  @IsOptional() @IsObject() dossierData?: Record<string, unknown>;
}

export class UpdateChildDto extends CreateChildDto {
  @IsOptional() @IsString() declare firstName: string;
  @IsOptional() @IsString() declare lastName: string;
  @IsOptional() @IsString() declare sex: string;
  @IsOptional() @IsString() changeNote?: string;
  @IsOptional() @IsString() fonarevStatus?: string;
  @IsOptional() @IsString() fonarevFileNumber?: string;
  @IsOptional() @IsString() fonarevNotes?: string;
  @IsOptional() @IsBoolean() postMajorityPrepared?: boolean;
  @IsOptional() @IsBoolean() tremplinScholarship?: boolean;
  @IsOptional() @IsString() mentorName?: string;
  @IsOptional() @IsString() aftercareNotes?: string;
  @IsOptional() @IsString() publicPhotoUrl?: string;
  @IsOptional() @IsString() photoUrl?: string;
}

export class ChangeStatusDto {
  @IsEnum(ChildStatus) status: ChildStatus;
  @IsOptional() @IsString() reason?: string;
}

export class AssignAmbassadorDto {
  @IsString() ambassadorId: string;
}

export class TimelineEventDto {
  @IsEnum(TimelineType) type: TimelineType;
  @IsString() @MinLength(3) title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() attachments?: string[];
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsEnum(Visibility) visibility?: Visibility;
  @IsOptional() @IsDateString() occurredAt?: string;
  @IsOptional() @IsString() correctsId?: string;
}

export class HealthRecordDto {
  @IsOptional() @IsString() bloodType?: string;
  @IsOptional() @IsString() vaccines?: string;
  @IsOptional() @IsString() illnesses?: string;
  @IsOptional() @IsString() disability?: string;
  @IsOptional() @IsString() treatments?: string;
  @IsOptional() @IsString() consultation?: string;
}

export class PsychoSessionDto {
  @IsOptional() @IsBoolean() isInitialAssessment?: boolean;
  @IsOptional() @IsString() evaluation?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() evolution?: string;
  @IsOptional() @IsDateString() sessionAt?: string;
}

export class SchoolRecordDto {
  @IsOptional() @IsString() school?: string;
  @IsOptional() @IsString() grade?: string;
  @IsOptional() @IsString() term?: string;
  @IsOptional() @IsString() year?: string;
  @IsOptional() @IsString() results?: string;
  @IsOptional() @IsNumber() average?: number;
  @IsOptional() @IsNumber() fees?: number;
  @IsOptional() @IsString() reportUrl?: string;
  @IsOptional() @IsString() publicSummary?: string;
}

export class ConsentDto {
  @IsOptional() @IsString() kind?: string;
  @IsString() guardianName: string;
  @IsOptional() @IsString() documentUrl?: string;
  @IsOptional() @IsBoolean() childSigned?: boolean;
}

export class TransferDto {
  @IsString() toOrphanageId: string;
  @IsOptional() @IsString() reason?: string;
}

export class VisitReportDto {
  @IsString() @MinLength(5) note: string;
  @IsOptional() @IsInt() rating?: number;
  @IsOptional() @IsArray() photos?: string[];
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
}
