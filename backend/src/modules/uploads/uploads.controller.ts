import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fsp from 'fs/promises';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { AntivirusService } from './antivirus.service';

const MAX_SIZE = 25 * 1024 * 1024;

const ALLOWED = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/** Fichiers et videos : limites de taille, types controles (section 12). */
const storage = diskStorage({
  destination: process.env.UPLOAD_DIR || './uploads',
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

function fileFilter(_req: any, file: Express.Multer.File, cb: any) {
  if (!ALLOWED.includes(file.mimetype)) {
    return cb(new BadRequestException(`Type de fichier non autorise : ${file.mimetype}`), false);
  }
  cb(null, true);
}

@Controller('uploads')
export class UploadsController {
  constructor(private antivirus: AntivirusService) {}

  /**
   * Analyse le fichier depose. Un fichier refuse est efface du disque
   * immediatement : rien d'infecte ne subsiste dans le dossier des televersements.
   */
  private async guard(file: Express.Multer.File) {
    const result = await this.antivirus.scanFile(file.path, file.mimetype);
    if (!result.clean) {
      await fsp.unlink(file.path).catch(() => undefined);
      throw new BadRequestException(result.reason ?? 'Fichier refuse');
    }
    return result;
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { storage, fileFilter, limits: { fileSize: MAX_SIZE } }))
  async upload(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthUser) {
    if (!file) throw new BadRequestException('Aucun fichier reçu');
    const scan = await this.guard(file);
    return {
      scanned: scan.scanned,
      url: `/uploads/${file.filename}`,
      name: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedBy: user.id,
    };
  }

  @Post('multiple')
  @UseInterceptors(
    FilesInterceptor('files', 10, { storage, fileFilter, limits: { fileSize: MAX_SIZE } }),
  )
  async uploadMany(@UploadedFiles() files: Express.Multer.File[], @CurrentUser() user: AuthUser) {
    if (!files?.length) throw new BadRequestException('Aucun fichier reçu');
    // Un seul fichier refuse fait echouer l'ensemble : pas de televersement partiel silencieux.
    for (const f of files) await this.guard(f);
    return files.map((file) => ({
      url: `/uploads/${file.filename}`,
      name: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedBy: user.id,
    }));
  }
}
