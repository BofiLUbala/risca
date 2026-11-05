import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  /**
   * Une erreur Prisma causée par la requête du client (champ manquant, identifiant
   * inconnu, doublon) est une erreur 4xx, pas une panne serveur.
   */
  private fromPrisma(exception: unknown): { status: number; message: string } | null {
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return { status: HttpStatus.BAD_REQUEST, message: 'Requête invalide : un champ obligatoire est manquant ou incorrect' };
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2025':
          return { status: HttpStatus.NOT_FOUND, message: 'Élément introuvable' };
        case 'P2002':
          return { status: HttpStatus.CONFLICT, message: 'Cet élément existe déjà' };
        case 'P2003':
          return { status: HttpStatus.BAD_REQUEST, message: 'Référence inconnue : un élément lié n’existe pas' };
        case 'P2000':
        case 'P2005':
        case 'P2006':
        case 'P2011':
        case 'P2012':
          return { status: HttpStatus.BAD_REQUEST, message: 'Requête invalide : valeur manquante ou incorrecte' };
      }
    }
    return null;
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const mapped = exception instanceof HttpException ? null : this.fromPrisma(exception);
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : (mapped?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);

    const payload =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: mapped?.message ?? 'Erreur interne du serveur' };

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url}`, (exception as Error)?.stack);
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      ...(typeof payload === 'string' ? { message: payload } : (payload as object)),
    });
  }
}
