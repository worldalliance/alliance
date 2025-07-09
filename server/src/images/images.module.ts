import { Module } from '@nestjs/common';
import { ImagesService } from './images.service';
import { ImagesController } from './images.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Image } from './entities/image.entity';
import { FilesService } from './files.service';
import { S3Module } from 'src/s3/s3.module';

@Module({
  imports: [TypeOrmModule.forFeature([Image]), S3Module],
  controllers: [ImagesController],
  providers: [FilesService, ImagesService],
  exports: [ImagesService],
})
export class ImagesModule {}
