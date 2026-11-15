import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: true });

  // L'API est derrière un relais (tunnel Cloudflare → pont Docker, ou Caddy) : on ne fait confiance qu'aux relais
  // locaux ou privés pour X-Forwarded-For, jamais à une adresse publique (sinon n'importe qui choisirait son IP).
  // TRUST_PROXY permet d'ajuster (« 1 », « false », liste d'adresses…).
  const trust = process.env.TRUST_PROXY?.trim();
  app.set(
    'trust proxy',
    !trust ? 'loopback, linklocal, uniquelocal' : /^\d+$/.test(trust) ? Number(trust) : trust === 'true' ? true : trust === 'false' ? false : trust,
  );

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cookieParser());
  app.setGlobalPrefix('api');

  app.enableCors({
    origin: (process.env.CORS_ORIGINS || 'http://localhost:3100,http://localhost:8081,http://localhost:19006').split(','),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const config = new DocumentBuilder()
    .setTitle('RISAC API')
    .setDescription('Réseau International des Structures d’Accueil du Congo')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.PORT) || 4000;
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`RISAC API en ecoute sur http://localhost:${port}/api`);
}

bootstrap();
