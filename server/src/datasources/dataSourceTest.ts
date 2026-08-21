import {
  assertWorktreeDatabase,
  DevDatabase,
  devPorts,
  PortCaller,
} from '@alliance/common/dev-ports';
import { assertNotDevDatabase } from '@alliance/common/dev-database';
import { NodeEnv } from '@alliance/common/node-env';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..', '..', '..');

export const testConnectionOptions = (): TypeOrmModuleOptions => {
  if (process.env.NODE_ENV !== NodeEnv.Test) {
    throw new Error(
      `testConnectionOptions() requires NODE_ENV=${NodeEnv.Test}, got ${process.env.NODE_ENV ?? '<unset>'} — refusing to run dropSchema against a database resolved without server/.env.test`,
    );
  }

  const database = process.env.TEST_DB_NAME ?? process.env.DB_NAME;

  if (!database) {
    throw new Error(
      'testConnectionOptions() found neither TEST_DB_NAME nor DB_NAME — set one rather than letting postgres pick a default database',
    );
  }

  assertNotDevDatabase({
    repoRoot,
    database,
    action: 'run dropSchema against',
    recovery:
      'DB_NAME is exported in your shell, where it outranks server/.env.test — unset it, or set TEST_DB_NAME to a throwaway database.',
  });

  assertWorktreeDatabase({
    ports: devPorts(PortCaller.Server),
    which: DevDatabase.Test,
    actual: database,
  });

  return {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: 5432,
    entities: ['src/**/*.entity{.ts,.js}'],
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database,
    autoLoadEntities: true,
    synchronize: true,
    dropSchema: true,
  };
};
