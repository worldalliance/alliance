import { FileValidator } from '@nestjs/common';

export class ImageMimeTypeValidator extends FileValidator {
  constructor(private validTypes: string[]) {
    super({});
  }

  isValid(file: Express.Multer.File): boolean {
    return this.validTypes.includes(file.mimetype);
  }

  buildErrorMessage(): string {
    return `File must be one of the following types: ${this.validTypes.join(', ')}`;
  }
}
