import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { S3Module } from "src/s3/s3.module";
import { User } from "src/user/entities/user.entity";
import { UserModule } from "src/user/user.module";
import { Video } from "./entities/video.entity";
import { VideosController } from "./videos.controller";
import { VideosService } from "./videos.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Video, User]),
    S3Module,
    forwardRef(() => UserModule),
  ],
  controllers: [VideosController],
  providers: [VideosService],
  exports: [VideosService],
})
export class VideosModule {}
