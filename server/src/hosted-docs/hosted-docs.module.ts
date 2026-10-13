import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { S3Module } from "src/s3/s3.module";
import { User } from "src/user/entities/user.entity";
import { HostedDoc } from "./entities/hosted-doc.entity";
import { DocsController, HostedDocsController } from "./hosted-docs.controller";
import { HostedDocsService } from "./hosted-docs.service";

@Module({
  imports: [TypeOrmModule.forFeature([HostedDoc, User]), S3Module],
  controllers: [HostedDocsController, DocsController],
  providers: [HostedDocsService],
})
export class HostedDocsModule {}
