import * as request from 'supertest';
import { join } from 'path';
import { unlinkSync, existsSync, mkdirSync } from 'fs';
import { createTestApp, TestContext } from './e2e-test-utils';
import { ForumModule } from '../src/forum/forum.module';
import { ImagesModule } from '../src/images/images.module';
import { Repository } from 'typeorm';
import { Image } from '../src/images/entities/image.entity';

describe.skip('Images (e2e)', () => {
  //TODO: s3 creds for test or more likely s3 mocking
  let ctx: TestContext;
  let uploadedFilename: string | null;
  let testImagePath: string;
  let imageRepo: Repository<Image>;
  // Ensure uploads directory exists for tests
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir);
  }

  beforeAll(async () => {
    ctx = await createTestApp([ForumModule, ImagesModule]);
    imageRepo = ctx.dataSource.getRepository(Image);

    testImagePath = join(__dirname, './test_image.jpg');
    uploadedFilename = null;
  }, 50000);

  afterEach(async () => {
    await imageRepo.query('DELETE FROM image');

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

      const response = await request(ctx.app.getHttpServer())
        .post('/images/upload')
        .attach('image', testImagePath)
        .expect(201);

      expect(response.body).toHaveProperty('key');
      expect(typeof response.body.key).toBe('string');

      uploadedFilename = response.body.key;

      const savedImage = await imageRepo.findOne({
        where: { key: response.body.key },
      });

      expect(savedImage).toBeDefined();
      expect(savedImage?.key).toEqual(response.body.key);
    });

    it('should reject non-image files', async () => {
      const textFilePath = join(__dirname, '../package.json');

      return request(ctx.app.getHttpServer())
        .post('/images/upload')
        .attach('image', textFilePath)
        .expect(400);
    });

    it('should require an image file', async () => {
      return request(ctx.app.getHttpServer())
        .post('/images/upload')
        .expect(400);
    });
  });

  describe('/images/:filename (GET)', () => {
    it('should retrieve an existing image', async () => {
      // Upload the image
      const uploadResponse = await request(ctx.app.getHttpServer())
        .post('/images/upload')
        .attach('image', testImagePath)
        .expect(201);

      // Get the filename from the response
      const { filename } = uploadResponse.body;
      uploadedFilename = filename;

      // Test retrieving the image
      const getResponse = await request(ctx.app.getHttpServer())
        .get(`/images/${filename}`)
        .expect(200)
        .expect('Content-Type', /image\/(jpeg|jpg)/);

      expect(getResponse.body).toBeInstanceOf(Buffer);
    });

    it('should return 404 for non-existent images', async () => {
      return request(ctx.app.getHttpServer())
        .get('/images/non-existent-image.jpg')
        .expect(404);
    });
  });

  it('should return false for non-existent image id', async () => {
    const nonExistentId = 999;

    return request(ctx.app.getHttpServer())
      .delete(`/images/${nonExistentId}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.deleted).toBe(false);
      });
  });

  afterAll(async () => {
    await ctx.app.close();
  });
});
