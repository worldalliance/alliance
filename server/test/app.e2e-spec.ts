import * as request from 'supertest';
import { createTestApp, TestContext } from './e2e-test-utils';
import { AppModule } from 'src/app.module';

describe('AppController (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([AppModule]);
  });

  describe('GET /', () => {
    it('should return 200 ok', async () => {
      const response = await request(ctx.app.getHttpServer()).get('/');
      expect(response.status).toBe(200);
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });
});
