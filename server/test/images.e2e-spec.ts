import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImagesModule } from '../src/images/images.module';
import { DataSource, Repository } from 'typeorm';
import { Image } from '../src/images/entities/image.entity';
import { join } from 'path';
import { unlinkSync, existsSync, mkdirSync } from 'fs';
import { AuthModule } from '../src/auth/auth.module';
import { UserModule } from '../src/user/user.module';
import { JwtModule } from '@nestjs/jwt';
import { ImagesController } from '../src/images/images.controller';

describe('Images (e2e)', () => {
  let app: INestApplication<App>;
  let imageRepository: Repository<Image>;
  let dataSource: DataSource;
  let uploadedFilename: string | null;
  let testImagePath: string;

  // Ensure uploads directory exists for tests
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forFeature([Image]),
        AuthModule,
        JwtModule,
        UserModule,
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Image],
          synchronize: true,
        }),
        ImagesModule,
      ],
      controllers: [ImagesController],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    imageRepository = dataSource.getRepository(Image);
    testImagePath = join(__dirname, './test_image.jpg');
    uploadedFilename = null;
  });

  afterEach(async () => {
    await imageRepository.query('DELETE FROM image');

    if (uploadedFilename && existsSync(join(uploadsDir, uploadedFilename))) {
      try {
        unlinkSync(join(uploadsDir, uploadedFilename));
      } catch (error) {
        console.error('Error deleting test file:', error);
      }
    }
  });

  describe('/images/upload (POST)', () => {
    it('should upload a valid image file', async () => {
      expect(existsSync(testImagePath)).toBe(true);

      const response = await request(app.getHttpServer())
        .post('/images/upload')
        .attach('image', testImagePath)
        .expect(201);

      expect(response.body).toHaveProperty('filename');
      expect(typeof response.body.filename).toBe('string');

      uploadedFilename = response.body.filename;

      const savedImage = await imageRepository.findOne({
        where: { filename: response.body.filename },
      });

      expect(savedImage).toBeDefined();
      expect(savedImage?.filename).toEqual(response.body.filename);
    });

    it('should reject non-image files', async () => {
      const textFilePath = join(__dirname, '../package.json');

      return request(app.getHttpServer())
        .post('/images/upload')
        .attach('image', textFilePath)
        .expect(400);
    });

    it('should require an image file', async () => {
      return request(app.getHttpServer()).post('/images/upload').expect(400);
    });
  });

  describe('/images/:filename (GET)', () => {
    it('should retrieve an existing image', async () => {
      // Upload the image
      const uploadResponse = await request(app.getHttpServer())
        .post('/images/upload')
        .attach('image', testImagePath)
        .expect(201);

      // Get the filename from the response
      const { filename } = uploadResponse.body;
      uploadedFilename = filename;

      // Test retrieving the image
      const getResponse = await request(app.getHttpServer())
        .get(`/images/${filename}`)
        .expect(200)
        .expect('Content-Type', /image\/(jpeg|jpg)/);

      expect(getResponse.body).toBeInstanceOf(Buffer);
    });

    it('should return 404 for non-existent images', async () => {
      return request(app.getHttpServer())
        .get('/images/non-existent-image.jpg')
        .expect(404);
    });
  });

  it('should return false for non-existent image id', async () => {
    const nonExistentId = 999;

    return request(app.getHttpServer())
      .delete(`/images/${nonExistentId}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.deleted).toBe(false);
      });
  });

  afterAll(async () => {
    await app.close();
  });
});
