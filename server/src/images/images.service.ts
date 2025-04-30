import { Injectable } from '@nestjs/common';
import { Image } from './entities/image.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class ImagesService {
  constructor(
    @InjectRepository(Image)
    private imageRepository: Repository<Image>,
  ) {}
  async getImages(): Promise<Image[]> {
    return this.imageRepository.find();
  }

  async createImage(image: Image): Promise<Image> {
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
    const result = await this.imageRepository.delete(id);
    if (result.affected === 0) {
      return false;
    }
    return true;
  }
}
