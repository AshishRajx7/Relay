import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from '@nestjs/common';

export interface FileValidationOptions {
  maxSizeInBytes?: number;
  allowedMimeTypes?: string[];
}

@Injectable()
export class FileValidationPipe implements PipeTransform {
  private readonly maxSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(options?: FileValidationOptions) {
    this.maxSize = options?.maxSizeInBytes || 10 * 1024 * 1024; // 10MB default
    this.allowedMimeTypes = options?.allowedMimeTypes || ['application/pdf'];
  }

  transform(file: Express.Multer.File): Express.Multer.File {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type "${file.mimetype}". Only ${this.allowedMimeTypes.join(', ')} files are allowed.`,
      );
    }

    if (file.size > this.maxSize) {
      const maxMb = (this.maxSize / (1024 * 1024)).toFixed(1);
      throw new BadRequestException(
        `File size exceeds maximum limit of ${maxMb}MB.`,
      );
    }

    // Check PDF magic header (%PDF-)
    if (file.buffer && file.buffer.length >= 4) {
      const header = file.buffer.toString('utf8', 0, 4);
      if (header !== '%PDF') {
        throw new BadRequestException('File is not a valid PDF document.');
      }
    }

    return file;
  }
}
