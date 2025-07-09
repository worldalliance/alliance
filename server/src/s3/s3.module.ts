// s3.module.ts
import { Module } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';

@Module({
  providers: [
    {
      provide: 'S3_CLIENT',
      useFactory: () =>
        new S3Client({
          // credentials are picked up automatically from the instance profile
          region: process.env.AWS_REGION ?? 'us-west-2',
        }),
    },
  ],
  exports: ['S3_CLIENT'],
})
export class S3Module {}
