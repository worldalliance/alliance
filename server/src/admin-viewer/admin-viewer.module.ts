import { Module } from '@nestjs/common';
import { AdminViewerService } from './admin-viewer.service';
import { AdminViewerController } from './admin-viewer.controller';
import { AdminViewerGateway } from './admin-viewer.gateway';
import { DatabaseListenerService } from './database-listener.service';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [UserModule],
  controllers: [AdminViewerController],
  providers: [AdminViewerService, AdminViewerGateway, DatabaseListenerService],
})
export class AdminViewerModule {}
