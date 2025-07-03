import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { useContainer } from 'class-validator';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';

function validateEnv() {
  const requiredVars = [
    'DB_HOST',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_NAME',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
  ];

  const missing = requiredVars.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    console.error(
      `ERR: Missing required environment variables: ${missing.join(', ')}`,
    );
    process.exit(1);
  }
}

class SocketIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: [
          'http://localhost:5173', //TODO: any localhost in dev
          'http://localhost:5174',
          'https://worldalliance.org',
          'https://admin.worldalliance.org',
        ],
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  validateEnv();
  app.useGlobalPipes(new ValidationPipe());
  app.use(cookieParser());
  //   app.enableCors();
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  app.useWebSocketAdapter(new SocketIoAdapter(app));
  app.set('trust proxy', 'loopback');

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Alliance API')
      .setVersion('1.0')
      .addTag('alliance')
      .addBearerAuth()
      .build();

    const documentFactory = () =>
      SwaggerModule.createDocument(app, config, {
        operationIdFactory: (controllerKey: string, methodKey: string) =>
          controllerKey.replace('Controller', '') + '_' + methodKey,
      });

    SwaggerModule.setup('openapi', app, documentFactory, {
      yamlDocumentUrl: '/openapi.yaml',
    });
  }

  await app.listen(process.env.PORT ?? 3005, '0.0.0.0');
}

void bootstrap();
