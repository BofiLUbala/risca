import { Body, Controller, HttpCode, HttpException, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { TranslateService } from './translate.service';
import type { Lang } from './detect';

class TranslateDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(5000, { each: true })
  texts!: string[];

  @IsIn(['fr', 'en'])
  target!: Lang;
}

/** Fenêtre glissante par adresse IP : la route est publique (pages publiques), on borne son usage. */
const WINDOW_MS = 60_000;
const MAX_TEXTS_PER_WINDOW = 600;
const usage = new Map<string, { start: number; count: number }>();

function allow(ip: string, n: number): boolean {
  const now = Date.now();
  const u = usage.get(ip);
  if (!u || now - u.start > WINDOW_MS) {
    if (usage.size > 10_000) usage.clear();
    usage.set(ip, { start: now, count: n });
    return true;
  }
  u.count += n;
  return u.count <= MAX_TEXTS_PER_WINDOW;
}

@ApiTags('translate')
@Controller('translate')
export class TranslateController {
  constructor(private readonly translate: TranslateService) {}

  /** Traduit des textes saisis par les personnes vers la langue d'affichage choisie (fr ou en). */
  @Public()
  @Post()
  @HttpCode(200)
  async run(@Body() dto: TranslateDto, @Req() req: Request) {
    if (!allow(req.ip ?? 'unknown', dto.texts.length)) {
      throw new HttpException('Trop de demandes de traduction, réessayez dans une minute.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const translations = await this.translate.translateMany(dto.texts, dto.target);
    return { translations, provider: this.translate.providerName };
  }
}
