import { Module } from '@nestjs/common';
import { AdminViewerService } from './admin-viewer.service';
import { AdminViewerController } from './admin-viewer.controller';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [UserModule],
  controllers: [AdminViewerController],
  providers: [AdminViewerService],
})
export class AdminViewerModule {}
