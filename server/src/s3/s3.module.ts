import { S3Client } from "@aws-sdk/client-s3";
import { Module } from "@nestjs/common";
import { env } from "../config/env";

@Module({
  providers: [
    {
      provide: "S3_CLIENT",
      useFactory: () =>
        new S3Client({
          // credentials are picked up automatically from the instance profile
          region: env("AWS_REGION"),
        }),
    },
  ],
  exports: ["S3_CLIENT"],
})
export class S3Module {}
