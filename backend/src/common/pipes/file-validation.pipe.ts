import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from '@nestjs/common';

export interface FileValidationOptions {
  maxSizeInBytes?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
}

@Injectable()
export class FileValidationPipe implements PipeTransform {
  private readonly maxSize: number;
  private readonly allowedMimeTypes: string[];
  private readonly allowedExtensions: string[];

  constructor(options?: FileValidationOptions) {
    this.maxSize = options?.maxSizeInBytes || 10 * 1024 * 1024; // 10MB default
    this.allowedMimeTypes = options?.allowedMimeTypes || ['application/pdf'];
    this.allowedExtensions = options?.allowedExtensions || [];
  }

  transform(file: Express.Multer.File): Express.Multer.File {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Check extension if specified
    if (this.allowedExtensions.length > 0) {
      const ext = file.originalname?.split('.').pop()?.toLowerCase() || '';
      if (!this.allowedExtensions.map((e) => e.toLowerCase().replace(/^\./, '')).includes(ext)) {
        throw new BadRequestException(
          `Invalid file extension ".${ext}". Allowed extensions: ${this.allowedExtensions.join(', ')}`,
        );
      }
    }

    // Check MIME type if allowedMimeTypes is provided
    if (this.allowedMimeTypes.length > 0) {
      const isValidMime = this.allowedMimeTypes.includes(file.mimetype) ||
        // Fallback for CSV files on various OS (Windows often sends application/vnd.ms-excel or text/plain)
        (this.allowedMimeTypes.includes('text/csv') &&
          ['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/csv', 'text/x-csv'].includes(file.mimetype));

      if (!isValidMime) {
        throw new BadRequestException(
          `Invalid file type "${file.mimetype}". Only ${this.allowedMimeTypes.join(', ')} files are allowed.`,
        );
      }
    }

    // Check file size
    if (file.size > this.maxSize) {
      const maxMb = (this.maxSize / (1024 * 1024)).toFixed(1);
      throw new BadRequestException(
        `File size exceeds maximum limit of ${maxMb}MB.`,
      );
    }

    // If PDF is the only allowed mime type, check PDF magic header (%PDF-)
    if (
      this.allowedMimeTypes.length === 1 &&
      this.allowedMimeTypes[0] === 'application/pdf' &&
      file.buffer &&
      file.buffer.length >= 4
    ) {
      const header = file.buffer.toString('utf8', 0, 4);
      if (header !== '%PDF') {
        throw new BadRequestException('File is not a valid PDF document.');
      }
    }

    return file;
  }
}
