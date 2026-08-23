export interface IStorageProvider {
  save(relativePath: string, buffer: Buffer): Promise<void>;
  read(relativePath: string): Promise<Buffer>;
  delete(relativePath: string): Promise<void>;
  exists(relativePath: string): Promise<boolean>;
}
