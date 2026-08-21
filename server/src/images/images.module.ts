import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { S3Module } from "src/s3/s3.module";
import { Image } from "./entities/image.entity";
import { ImagesController } from "./images.controller";
import { ImagesService } from "./images.service";

@Module({
  imports: [TypeOrmModule.forFeature([Image]), S3Module],
  controllers: [ImagesController],
  providers: [ImagesService],
  exports: [ImagesService],
})
export class ImagesModule {}
