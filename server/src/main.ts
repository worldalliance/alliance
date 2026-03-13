import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import bodyParser from 'body-parser';
import { useContainer } from 'class-validator';
import cookieParser from 'cookie-parser';
import { PostHog, setupExpressErrorHandler } from 'posthog-node';
import type { ServerOptions } from 'socket.io';
import { AppModule } from './app.module';
import { PosthogExceptionFilter } from './posthog.filter';
import { MetricsInterceptor } from './metrics';

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
          process.env.APP_URL,
          'https://admin.worldalliance.org',
        ],
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });
  }
}

async function bootstrap() {
  const port = Number(process.env.PORT ?? '3005');
  let client: PostHog | null = null;

  if (process.env.NODE_ENV === 'production') {
    client = new PostHog(process.env.POSTHOG_KEY!, {
      host: 'https://us.i.posthog.com',
    });
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bodyParser: false,
  });
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  validateEnv();
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidUnknownValues: true,
      disableErrorMessages: false,
    }),
  );
  app.useGlobalInterceptors(new MetricsInterceptor());
  app.use(cookieParser());
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

  if (client) {
    const { httpAdapter } = app.get(HttpAdapterHost);
    app.useGlobalFilters(new PosthogExceptionFilter(client, httpAdapter));
    setupExpressErrorHandler(client, app);
  }

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
