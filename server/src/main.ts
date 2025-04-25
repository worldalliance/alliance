import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log(
    'DB_PASSWORD:',
    typeof process.env.DB_PASSWORD,
    process.env.DB_PASSWORD ? '[exists]' : '[missing]',
  );

  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(process.env.PORT ?? 3005, '0.0.0.0');
}

void bootstrap();
