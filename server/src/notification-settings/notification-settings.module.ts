import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationPreference } from "./notification-preference.entity";
import { NotificationPreferencesService } from "./notification-preferences.service";

@Module({
  imports: [TypeOrmModule.forFeature([NotificationPreference])],
  providers: [NotificationPreferencesService],
  exports: [NotificationPreferencesService],
})
export class NotificationSettingsModule {}
