import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { parse } from 'csv-parse/sync';

export interface ParsedContactRow {
  rowNumber: number;
  name: string;
  email: string;
  company: string;
  website: string;
  isValid: boolean;
  errorReason?: string;
}

export interface CsvParseResult {
  totalRows: number;
  rows: ParsedContactRow[];
}

@Injectable()
export class ContactsCsvParserService {
  private readonly logger = new Logger(ContactsCsvParserService.name);
  private readonly emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Parses CSV buffer into structured rows with per-row validation.
   * Expects columns: name, email, company, website (case-insensitive).
   */
  parse(buffer: Buffer): CsvParseResult {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('CSV file is empty.');
    }

    const content = buffer.toString('utf8');
    let records: Record<string, string>[];

    try {
      records = parse(content, {
        columns: (header: string[]) =>
          header.map((col) => col.trim().toLowerCase().replace(/^["']|["']$/g, '')),
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      });
    } catch (err: any) {
      this.logger.error(`CSV syntax parse error: ${err.message}`);
      throw new BadRequestException(`Failed to parse CSV file: ${err.message}`);
    }

    if (!records || records.length === 0) {
      throw new BadRequestException('CSV file contains no data rows.');
    }

    // Verify required headers
    const sampleRecord = records[0];
    const keys = Object.keys(sampleRecord);
    const required = ['name', 'email', 'company', 'website'];
    const missing = required.filter((req) => !keys.includes(req));

    if (missing.length > 0) {
      throw new BadRequestException(
        `CSV is missing required columns: ${missing.join(', ')}. Expected: name, email, company, website.`,
      );
    }

    const rows: ParsedContactRow[] = records.map((record, index) => {
      const rowNumber = index + 2; // +1 for 1-based index, +1 for header row
      const name = (record['name'] || '').trim();
      const email = (record['email'] || '').trim().toLowerCase();
      const company = (record['company'] || '').trim();
      const website = (record['website'] || '').trim();

      // Row validation
      if (!name) {
        return {
          rowNumber,
          name,
          email,
          company,
          website,
          isValid: false,
          errorReason: 'Missing contact name',
        };
      }

      if (!email) {
        return {
          rowNumber,
          name,
          email,
          company,
          website,
          isValid: false,
          errorReason: 'Missing contact email',
        };
      }

      if (!this.emailRegex.test(email)) {
        return {
          rowNumber,
          name,
          email,
          company,
          website,
          isValid: false,
          errorReason: `Invalid email format: "${email}"`,
        };
      }

      if (!company) {
        return {
          rowNumber,
          name,
          email,
          company,
          website,
          isValid: false,
          errorReason: 'Missing company name',
        };
      }

      if (!website) {
        return {
          rowNumber,
          name,
          email,
          company,
          website,
          isValid: false,
          errorReason: 'Missing company website',
        };
      }

      return {
        rowNumber,
        name,
        email,
        company,
        website,
        isValid: true,
      };
    });

    return {
      totalRows: rows.length,
      rows,
    };
  }
}
