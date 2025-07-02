import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Post,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  Res,
  StreamableFile,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { ImagesService } from './images.service';
import {
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBody,
  ApiProduces,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  DeleteImageResponseDto,
  ImageResponseDto,
} from './dto/image-response.dto';
import { createReadStream, existsSync } from 'fs';
import { Response } from 'express';
import { ImageMimeTypeValidator } from './image-validator.pipe';

const allowedTypes = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
];

function imageFileFilter(
  _req: Request,
  file: Express.Multer.File,
  callback: (error: Error | null, accept: boolean) => void,
) {
  if (allowedTypes.includes(file.mimetype)) {
    return callback(null, true);
  }
  callback(new BadRequestException('Unsupported file type'), false); // reject
}

@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: '../uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix = uuidv4();
          const extension = extname(file.originalname);
          const filename = `${uniqueSuffix}${extension}`;
          callback(null, filename);
        },
      }),
      fileFilter: imageFileFilter,
    }),
  )
  @ApiCreatedResponse({ type: ImageResponseDto })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1000 * 1000 * 1000 }),
          new ImageMimeTypeValidator(allowedTypes),
        ],
      }),
    )
    image: Express.Multer.File,
  ) {
    console.log('Stored file path:', image.path);
    const imageEntity = await this.imagesService.createImage(image);
    return {
      id: imageEntity.id,
      filename: imageEntity.filename,
    };
  }

  @Get(':filename')
  @ApiOkResponse({
    description: 'Returns an image file',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  @ApiProduces('image/*')
  async getImage(
    @Res({ passthrough: true }) res: Response,
    @Param('filename') filename: string,
  ): Promise<StreamableFile> {
    const imagePath = join(process.cwd(), '../uploads', filename);

    if (!existsSync(imagePath)) {
      throw new NotFoundException(`Image ${filename} not found`);
    }

    const ext = extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';

    switch (ext) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
    }

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${filename}"`,
    });

    const fileStream = createReadStream(imagePath);
    return new StreamableFile(fileStream);
  }

  @Delete(':id')
  @ApiOkResponse({ type: DeleteImageResponseDto })
  async deleteImage(@Param('id') id: number): Promise<{ deleted: boolean }> {
    console.log('Deleting image with id:', id);
    const result = await this.imagesService.deleteImage(id);
    console.log('Result:', result);
    return { deleted: result };
  }
}
