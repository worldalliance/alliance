import { Injectable } from '@nestjs/common';
import { Image } from './entities/image.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { FilesService } from './files.service';

@Injectable()
export class ImagesService {
  constructor(
    @InjectRepository(Image)
    private imageRepository: Repository<Image>,
    private filesService: FilesService,
  ) {}
  async getImages(): Promise<Image[]> {
    return this.imageRepository.find();
  }

  async createImage(
    image: Pick<Image, 'key' | 'mime' | 'size'>,
  ): Promise<Image> {
    return this.imageRepository.save(image);
  }

  async getImage(id: number): Promise<Image | null> {
    const image = await this.imageRepository.findOneBy({ id });
    if (!image) {
      console.log('Image not found');
      return null;
    }
    return image;
  }

  async deleteImage(id: number): Promise<boolean> {
    console.log('Deleting image with id:', id);
    const image = await this.getImage(id);
    console.log('Image:', image);
    if (!image) {
      console.log('Image not found');
      return false;
    }
    await this.imageRepository.delete(id);
    await this.filesService.deleteFile(image.key);

    return true;
  }
}
