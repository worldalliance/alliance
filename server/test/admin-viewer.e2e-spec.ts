/* eslint-disable @typescript-eslint/no-explicit-any */
import { Repository } from 'typeorm';
import * as request from 'supertest';
import { User } from '../src/user/user.entity';
import { Action, ActionStatus } from '../src/actions/entities/action.entity';
import { createTestApp, TestContext } from './e2e-test-utils';
import { AdminViewerModule } from '../src/admin-viewer/admin-viewer.module';
import { TableMetadataDto } from 'src/admin-viewer/dto/table-list.dto';
import { ColumnMetadataDto } from 'src/admin-viewer/dto/column-metadata.dto';

describe('AdminViewer (e2e)', () => {
  let ctx: TestContext;
  let userRepository: Repository<User>;
  let actionRepository: Repository<Action>;

  beforeAll(async () => {
    ctx = await createTestApp([AdminViewerModule]);
    userRepository = ctx.dataSource.getRepository(User);
    actionRepository = ctx.dataSource.getRepository(Action);
  }, 50000);

  describe('GET /admin-viewer/tables', () => {
    it('should return list of database tables for admin user', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/admin-viewer/tables')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('tables');
      expect(Array.isArray(response.body.tables)).toBe(true);
      expect(response.body.tables.length).toBeGreaterThan(0);

      // Check that we have some expected tables
      const tableNames = response.body.tables.map(
        (t: TableMetadataDto) => t.name,
      );
      expect(tableNames).toContain('user');
      expect(tableNames).toContain('action');

      // Validate table metadata structure
      const userTable = response.body.tables.find(
        (t: TableMetadataDto) => t.name === 'user',
      );
      expect(userTable).toHaveProperty('name', 'user');
      expect(userTable).toHaveProperty('entityName', 'User');
      expect(userTable).toHaveProperty('recordCount');
      expect(userTable).toHaveProperty('primaryKey');
      expect(typeof userTable.recordCount).toBe('number');
    });

    it('should deny access to non-admin users', async () => {
      await request(ctx.app.getHttpServer())
        .get('/admin-viewer/tables')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(401);
    });

    it('should deny access to unauthenticated users', async () => {
      await request(ctx.app.getHttpServer())
        .get('/admin-viewer/tables')
        .expect(401);
    });
  });

  describe('GET /admin-viewer/tables/:tableName/data', () => {
    beforeEach(async () => {
      // Create some test data
      const testUser = userRepository.create({
        name: 'Test User for Admin Viewer',
        email: 'test-admin-viewer@example.com',
        password: 'password123',
        admin: false,
      });
      await userRepository.save(testUser);

      const testAction = actionRepository.create({
        name: 'Test Action',
        category: 'Test',
        body: 'Test action for forum tests',
        status: ActionStatus.GatheringCommitments,
      });

      await actionRepository.save(testAction);
    });

    afterEach(async () => {
      // Clean up test data
      await userRepository.query('DELETE FROM "user" WHERE email = $1', [
        'test-admin-viewer@example.com',
      ]);
      await actionRepository.query('DELETE FROM "action" WHERE name = $1', [
        'Test Action for Admin Viewer',
      ]);
    });

    it('should return table data with proper structure', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/admin-viewer/tables/user/data')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('columns');
      expect(response.body).toHaveProperty('rows');
      expect(response.body).toHaveProperty('totalCount');
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 50);
      expect(response.body).toHaveProperty('totalPages');

      // Validate columns structure
      expect(Array.isArray(response.body.columns)).toBe(true);
      expect(response.body.columns.length).toBeGreaterThan(0);

      const idColumn = response.body.columns.find(
        (col: ColumnMetadataDto) => col.name === 'id',
      );
      expect(idColumn).toBeDefined();
      expect(idColumn).toHaveProperty('dataType');
      expect(idColumn).toHaveProperty('rawType');
      expect(idColumn).toHaveProperty('isPrimary', true);
      expect(idColumn).toHaveProperty('isNullable');

      // Validate rows structure
      expect(Array.isArray(response.body.rows)).toBe(true);
      expect(response.body.totalCount).toBeGreaterThan(0);

      if (response.body.rows.length > 0) {
        expect(response.body.rows[0].length).toBe(response.body.columns.length);
      }
    });

    it('should support pagination', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/admin-viewer/tables/user/data')
        .query({ page: 1, limit: 2 })
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(2);
      expect(response.body.rows.length).toBeLessThanOrEqual(2);
    });

    it('should support sorting', async () => {
      const responseAsc = await request(ctx.app.getHttpServer())
        .get('/admin-viewer/tables/user/data')
        .query({ sortBy: 'id', sortOrder: 'ASC', limit: 10 })
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      const responseDesc = await request(ctx.app.getHttpServer())
        .get('/admin-viewer/tables/user/data')
        .query({ sortBy: 'id', sortOrder: 'DESC', limit: 10 })
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      if (
        responseAsc.body.rows.length > 1 &&
        responseDesc.body.rows.length > 1
      ) {
        const firstIdAsc = responseAsc.body.rows[0][0]; // Assuming id is first column
        const firstIdDesc = responseDesc.body.rows[0][0];
        const lastIdAsc =
          responseAsc.body.rows[responseAsc.body.rows.length - 1][0];

        expect(firstIdAsc).toBeLessThanOrEqual(lastIdAsc); // ASC order
        expect(firstIdDesc).toBeGreaterThanOrEqual(
          responseDesc.body.rows[1][0],
        ); // DESC order
      }
    });

    it('should support search functionality', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/admin-viewer/tables/user/data')
        .query({ search: 'Test User for Admin Viewer' })
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      expect(response.body.totalCount).toBeGreaterThan(0);

      // Find the name column index
      const nameColumnIndex = response.body.columns.findIndex(
        (col: ColumnMetadataDto) => col.name === 'name',
      );
      if (nameColumnIndex >= 0 && response.body.rows.length > 0) {
        const foundUser = response.body.rows.find(
          (row: any) => row[nameColumnIndex] === 'Test User for Admin Viewer',
        );
        expect(foundUser).toBeDefined();
      }
    });

    it('should return empty results for non-matching search', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/admin-viewer/tables/user/data')
        .query({ search: 'non-existent-user-12345' })
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      expect(response.body.totalCount).toBe(0);
      expect(response.body.rows).toHaveLength(0);
    });

    it('should handle invalid table names', async () => {
      await request(ctx.app.getHttpServer())
        .get('/admin-viewer/tables/non_existent_table/data')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(404); // Should return 404 for non-existent table
    });

    it('should deny access to non-admin users', async () => {
      await request(ctx.app.getHttpServer())
        .get('/admin-viewer/tables/user/data')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(401);
    });

    it('should deny access to unauthenticated users', async () => {
      await request(ctx.app.getHttpServer())
        .get('/admin-viewer/tables/user/data')
        .expect(401);
    });

    it('should validate query parameters', async () => {
      // Test invalid page number
      await request(ctx.app.getHttpServer())
        .get('/admin-viewer/tables/user/data')
        .query({ page: 0 })
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(400);

      // Test invalid limit
      await request(ctx.app.getHttpServer())
        .get('/admin-viewer/tables/user/data')
        .query({ limit: 0 })
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(400);

      // Test invalid sort order
      await request(ctx.app.getHttpServer())
        .get('/admin-viewer/tables/user/data')
        .query({ sortOrder: 'INVALID' })
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(400);
    });

    it('should handle relation columns correctly', async () => {
      // Test with a table that has relations (assuming action table has user relations)
      const response = await request(ctx.app.getHttpServer())
        .get('/admin-viewer/tables/action/data')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      const relationColumns = response.body.columns.filter(
        (col: any) => col.dataType === 'relation',
      );

      relationColumns.forEach((col: any) => {
        expect(col).toHaveProperty('relationTarget');
        expect(col).toHaveProperty('relationType');
        expect([
          'one-to-one',
          'one-to-many',
          'many-to-one',
          'many-to-many',
        ]).toContain(col.relationType);
      });
    });

    it('should handle different data types correctly', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/admin-viewer/tables/user/data')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      const columns = response.body.columns;

      // Check for different data types
      const stringColumn = columns.find(
        (col: any) => col.dataType === 'string',
      );
      const numberColumn = columns.find(
        (col: any) => col.dataType === 'number',
      );
      const booleanColumn = columns.find(
        (col: any) => col.dataType === 'boolean',
      );

      if (stringColumn) {
        expect(stringColumn).toHaveProperty('rawType');
        expect(
          ['varchar', 'text', 'char', 'string'].some((type) =>
            stringColumn.rawType.toLowerCase().includes(type),
          ),
        ).toBe(true);
      }

      if (numberColumn) {
        expect(
          ['int', 'integer', 'bigint', 'decimal', 'numeric', 'number'].some(
            (type) => numberColumn.rawType.toLowerCase().includes(type),
          ),
        ).toBe(true);
      }

      if (booleanColumn) {
        expect(
          ['boolean', 'bool'].some((type) =>
            booleanColumn.rawType.toLowerCase().includes(type),
          ),
        ).toBe(true);
      }
    });

    it('should handle large datasets with proper pagination', async () => {
      // Test with large limit to ensure it's rejected
      await request(ctx.app.getHttpServer())
        .get('/admin-viewer/tables/user/data')
        .query({ limit: 2000 }) // Should be rejected as too large
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(400); // Should return validation error

      // Test with valid large limit
      const response = await request(ctx.app.getHttpServer())
        .get('/admin-viewer/tables/user/data')
        .query({ limit: 1000 }) // Should be accepted as max limit
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      expect(response.body.limit).toBe(1000);
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });
});
