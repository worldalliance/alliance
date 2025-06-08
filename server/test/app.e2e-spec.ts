import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { User } from '../src/user/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Action } from '../src/actions/entities/action.entity';
import { AppController } from '../src/app.controller';
import { AuthModule } from '../src/auth/auth.module';
import { UserModule } from '../src/user/user.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { UserAction } from '../src/actions/entities/user-action.entity';
import { Image } from '../src/images/entities/image.entity';
import { ImagesModule } from '../src/images/images.module';
import { CommuniquesModule } from '../src/communiques/communiques.module';
import { Communique } from '../src/communiques/entities/communique.entity';
import { Friend } from '../src/user/friend.entity';
import { Notification } from '../src/notifs/entities/notification.entity';
import { ActionEvent } from '../src/actions/entities/action-event.entity';
import { City } from '../src/geo/city.entity';
describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        AuthModule,
        JwtModule,
        UserModule,
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [
            User,
            Action,
            UserAction,
            Image,
            Communique,
            Friend,
            Notification,
            ActionEvent,
            City,
          ],
          synchronize: true,
        }),
        ImagesModule,
        CommuniquesModule,
      ],
      controllers: [AppController],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  describe('GET /', () => {
    it('should return 200 ok', async () => {
      const response = await request(app.getHttpServer()).get('/');
      expect(response.status).toBe(200);
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
