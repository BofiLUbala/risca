import { Global, Module } from '@nestjs/common';
import { ScopeService } from './services/scope.service';
import { AuditService } from './services/audit.service';
import { ContentSafetyService } from './services/content-safety.service';
import { NotificationsService } from './services/notifications.service';
import { SettingsService } from './services/settings.service';
import { MailerService } from './services/mailer.service';
import { PushService } from './services/push.service';
import { BackupService } from './services/backup.service';

@Global()
@Module({
  providers: [ScopeService, AuditService, ContentSafetyService, NotificationsService, SettingsService, MailerService, PushService, BackupService],
  exports: [ScopeService, AuditService, ContentSafetyService, NotificationsService, SettingsService, MailerService, PushService, BackupService],
})
export class CommonModule {}
