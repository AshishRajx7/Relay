import { Injectable, Inject, Logger } from '@nestjs/common';
import { IStorageProvider } from './providers/storage-provider.interface';
import { STORAGE_PROVIDER_TOKEN } from '../../common/constants/app.constants';
import { RESUMES_STORAGE_DIR } from './constants/storage.constants';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(STORAGE_PROVIDER_TOKEN)
    private readonly storageProvider: IStorageProvider,
  ) {}

  /**
   * Saves a resume PDF and returns the relative storage path
   */
  async saveResume(resumeId: string, originalFileName: string, buffer: Buffer): Promise<string> {
    const ext = path.extname(originalFileName) || '.pdf';
    const sanitizedBase = path
      .basename(originalFileName, ext)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-');
    const fileName = `${resumeId}-${sanitizedBase}${ext}`;
    const relativePath = path.join(RESUMES_STORAGE_DIR, resumeId, fileName).replace(/\\/g, '/');

    await this.storageProvider.save(relativePath, buffer);
    this.logger.log(`Stored resume file: ${relativePath}`);
    return relativePath;
  }

  async readFile(relativePath: string): Promise<Buffer> {
    return await this.storageProvider.read(relativePath);
  }

  async deleteFile(relativePath: string): Promise<void> {
    await this.storageProvider.delete(relativePath);
  }

  async fileExists(relativePath: string): Promise<boolean> {
    return await this.storageProvider.exists(relativePath);
  }
}
