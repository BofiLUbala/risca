import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { APP_GUARD } from '@nestjs/core';
import { MaintenanceGuard } from './common/guards/maintenance.guard';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { GeoModule } from './modules/geo/geo.module';
import { UsersModule } from './modules/users/users.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { OrphanagesModule } from './modules/orphanages/orphanages.module';
import { ChildrenModule } from './modules/children/children.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { PostsModule } from './modules/posts/posts.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { DisbursementsModule } from './modules/disbursements/disbursements.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), process.env.UPLOAD_DIR || 'uploads'),
      serveRoot: '/uploads',
    }),
    PrismaModule,
    CommonModule,
    AuthModule,
    GeoModule,
    UsersModule,
    ApprovalsModule,
    OrphanagesModule,
    ChildrenModule,
    TemplatesModule,
    ProjectsModule,
    PostsModule,
    ChannelsModule,
    LedgerModule,
    PaymentsModule,
    DisbursementsModule,
    ModerationModule,
    NotificationsModule,
    UploadsModule,
    DashboardModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Apres l'authentification : la maintenance doit connaitre le role appelant.
    { provide: APP_GUARD, useClass: MaintenanceGuard },
  ],
})
export class AppModule {}
