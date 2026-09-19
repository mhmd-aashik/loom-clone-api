import { Injectable } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor() {
    const endpoint = process.env.RAILWAY_BUCKET_ENDPOINT;

    const region = process.env.RAILWAY_BUCKET_REGION;

    const bucketName = process.env.RAILWAY_BUCKET_NAME;

    const accessKeyId = process.env.RAILWAY_BUCKET_ACCESS_KEY_ID;

    const secretAccessKey = process.env.RAILWAY_BUCKET_SECRET_ACCESS_KEY;

    if (
      !endpoint ||
      !region ||
      !bucketName ||
      !accessKeyId ||
      !secretAccessKey
    ) {
      throw new Error('Railway storage configuration is missing');
    }

    this.bucketName = bucketName;

    this.s3Client = new S3Client({
      endpoint,
      region,

      credentials: {
        accessKeyId,
        secretAccessKey,
      },

      // Useful for many S3-compatible storage providers.
      forcePathStyle: true,
    });
  }
}
