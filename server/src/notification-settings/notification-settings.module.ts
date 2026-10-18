import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationPreference } from "./notification-preference.entity";
import { NotificationPreferencesService } from "./notification-preferences.service";
import { NotificationSettingsController } from "./notification-settings.controller";
import { NotificationSettingsService } from "./notification-settings.service";

@Module({
  imports: [TypeOrmModule.forFeature([NotificationPreference])],
  controllers: [NotificationSettingsController],
  providers: [NotificationPreferencesService, NotificationSettingsService],
  exports: [NotificationPreferencesService],
})
export class NotificationSettingsModule {}
