import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class FilesService {
  async deleteFile(filename: string): Promise<void> {
    try {
      let filePath = join(process.cwd(), '../uploads', filename);
      if (process.env.NODE_ENV === 'test') {
        console.log('dirname:', __dirname);
        filePath = join(__dirname, '..', '..', 'uploads', filename);
        console.log('filePath:', filePath);
      }
      await unlink(filePath);
    } catch (error) {
      throw new InternalServerErrorException(
        `Error deleting file: ${error.message}`,
      );
    }
  }
}
