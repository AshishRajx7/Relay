import { Injectable, Logger } from '@nestjs/common';
import { IStorageProvider } from './storage-provider.interface';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly rootDir: string;

  constructor(rootDir: string = './uploads') {
    this.rootDir = path.resolve(rootDir);
  }

  private getFullPath(relativePath: string): string {
    // Prevent directory traversal
    const safePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
    return path.join(this.rootDir, safePath);
  }

  async save(relativePath: string, buffer: Buffer): Promise<void> {
    const fullPath = this.getFullPath(relativePath);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, buffer);
    this.logger.debug(`Saved file to ${fullPath}`);
  }

  async read(relativePath: string): Promise<Buffer> {
    const fullPath = this.getFullPath(relativePath);
    return await fs.readFile(fullPath);
  }

  async delete(relativePath: string): Promise<void> {
    const fullPath = this.getFullPath(relativePath);
    try {
      await fs.unlink(fullPath);
      this.logger.debug(`Deleted file ${fullPath}`);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async exists(relativePath: string): Promise<boolean> {
    const fullPath = this.getFullPath(relativePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
