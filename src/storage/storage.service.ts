import { Injectable } from '@nestjs/common';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

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

  async createUploadUrl(storageKey: string, contentType: string) {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 60 * 10, // 10 minutes
    });

    return uploadUrl;
  }

  async getObjectMetadata(storageKey: string) {
    const command = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
    });

    const response = await this.s3Client.send(command);

    return {
      sizeBytes: response.ContentLength,
      contentType: response.ContentType,
    };
  }

  async downloadObject(storageKey: string): Promise<Uint8Array> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
    });

    const response = await this.s3Client.send(command);

    if (!response.Body) {
      throw new Error('Storage object has no body');
    }

    return response.Body.transformToByteArray();
  }
}
