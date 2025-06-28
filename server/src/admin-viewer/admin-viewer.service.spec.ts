import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, EntityMetadata } from 'typeorm';
import { AdminViewerService } from './admin-viewer.service';
import { ColumnDataType } from './dto/column-type.enum';

describe('AdminViewerService', () => {
  let service: AdminViewerService;
  let mockDataSource: Partial<DataSource>;

  beforeEach(async () => {
    mockDataSource = {
      get entityMetadatas() { return []; },
      createQueryRunner: jest.fn().mockReturnValue({
        query: jest.fn(),
        release: jest.fn(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminViewerService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<AdminViewerService>(AdminViewerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('mapColumnType', () => {
    it('should map string types correctly', () => {
      const mapColumnType = (service as any).mapColumnType.bind(service);
      expect(mapColumnType('varchar')).toBe(ColumnDataType.STRING);
      expect(mapColumnType('text')).toBe(ColumnDataType.STRING);
      expect(mapColumnType('char')).toBe(ColumnDataType.STRING);
      expect(mapColumnType('character')).toBe(ColumnDataType.STRING);
      expect(mapColumnType('character varying')).toBe(ColumnDataType.STRING);
    });

    it('should map number types correctly', () => {
      const mapColumnType = (service as any).mapColumnType.bind(service);
      expect(mapColumnType('int')).toBe(ColumnDataType.NUMBER);
      expect(mapColumnType('integer')).toBe(ColumnDataType.NUMBER);
      expect(mapColumnType('bigint')).toBe(ColumnDataType.NUMBER);
      expect(mapColumnType('smallint')).toBe(ColumnDataType.NUMBER);
      expect(mapColumnType('decimal')).toBe(ColumnDataType.NUMBER);
      expect(mapColumnType('numeric')).toBe(ColumnDataType.NUMBER);
      expect(mapColumnType('real')).toBe(ColumnDataType.NUMBER);
      expect(mapColumnType('double')).toBe(ColumnDataType.NUMBER);
      expect(mapColumnType('float')).toBe(ColumnDataType.NUMBER);
      expect(mapColumnType('money')).toBe(ColumnDataType.NUMBER);
    });

    it('should map boolean types correctly', () => {
      const mapColumnType = (service as any).mapColumnType.bind(service);
      expect(mapColumnType('boolean')).toBe(ColumnDataType.BOOLEAN);
      expect(mapColumnType('bool')).toBe(ColumnDataType.BOOLEAN);
    });

    it('should map JavaScript constructor types correctly', () => {
      const mapColumnType = (service as any).mapColumnType.bind(service);
      expect(mapColumnType('number')).toBe(ColumnDataType.NUMBER);
      expect(mapColumnType('string')).toBe(ColumnDataType.STRING);
      expect(mapColumnType('boolean')).toBe(ColumnDataType.BOOLEAN);
      expect(mapColumnType('date')).toBe(ColumnDataType.DATETIME);
    });

    it('should map date types correctly', () => {
      const mapColumnType = (service as any).mapColumnType.bind(service);
      expect(mapColumnType('dateonly')).toBe(ColumnDataType.DATE);
    });

    it('should map datetime types correctly', () => {
      const mapColumnType = (service as any).mapColumnType.bind(service);
      expect(mapColumnType('timestamp')).toBe(ColumnDataType.DATETIME);
      expect(mapColumnType('timestamptz')).toBe(ColumnDataType.DATETIME);
      expect(mapColumnType('datetime')).toBe(ColumnDataType.DATETIME);
      expect(mapColumnType('time')).toBe(ColumnDataType.DATETIME);
      expect(mapColumnType('timetz')).toBe(ColumnDataType.DATETIME);
    });

    it('should map JSON types correctly', () => {
      const mapColumnType = (service as any).mapColumnType.bind(service);
      expect(mapColumnType('json')).toBe(ColumnDataType.JSON);
      expect(mapColumnType('jsonb')).toBe(ColumnDataType.JSON);
    });

    it('should map UUID types correctly', () => {
      const mapColumnType = (service as any).mapColumnType.bind(service);
      expect(mapColumnType('uuid')).toBe(ColumnDataType.UUID);
    });

    it('should map enum types correctly', () => {
      const mapColumnType = (service as any).mapColumnType.bind(service);
      expect(mapColumnType('enum')).toBe(ColumnDataType.ENUM);
    });

    it('should handle case insensitive mapping', () => {
      const mapColumnType = (service as any).mapColumnType.bind(service);
      expect(mapColumnType('VARCHAR')).toBe(ColumnDataType.STRING);
      expect(mapColumnType('INTEGER')).toBe(ColumnDataType.NUMBER);
      expect(mapColumnType('BOOLEAN')).toBe(ColumnDataType.BOOLEAN);
    });

    it('should return UNKNOWN for unrecognized types', () => {
      const mapColumnType = (service as any).mapColumnType.bind(service);
      expect(mapColumnType('custom_type')).toBe(ColumnDataType.UNKNOWN);
      expect(mapColumnType('weird_type')).toBe(ColumnDataType.UNKNOWN);
      expect(mapColumnType('')).toBe(ColumnDataType.UNKNOWN);
    });
  });

  describe('getColumnMetadata', () => {
    it('should process regular columns correctly', () => {
      const getColumnMetadata = (service as any).getColumnMetadata.bind(service);
      const mockMetadata = {
        columns: [
          {
            databaseName: 'id',
            type: 'integer',
            isPrimary: true,
            isNullable: false,
            enum: undefined,
          },
          {
            databaseName: 'name',
            type: 'varchar',
            isPrimary: false,
            isNullable: false,
            enum: undefined,
          },
          {
            databaseName: 'status',
            type: 'enum',
            isPrimary: false,
            isNullable: false,
            enum: { ACTIVE: 'active', INACTIVE: 'inactive' },
          },
        ],
        relations: [],
      } as unknown as EntityMetadata;

      const result = getColumnMetadata(mockMetadata);

      expect(result).toHaveLength(3);
      
      const idColumn = result.find((col: any) => col.name === 'id');
      expect(idColumn).toEqual({
        name: 'id',
        dataType: ColumnDataType.NUMBER,
        rawType: 'integer',
        isPrimary: true,
        isNullable: false,
        enumValues: undefined,
      });

      const nameColumn = result.find((col: any) => col.name === 'name');
      expect(nameColumn).toEqual({
        name: 'name',
        dataType: ColumnDataType.STRING,
        rawType: 'varchar',
        isPrimary: false,
        isNullable: false,
        enumValues: undefined,
      });

      const statusColumn = result.find((col: any) => col.name === 'status');
      expect(statusColumn).toEqual({
        name: 'status',
        dataType: ColumnDataType.ENUM,
        rawType: 'enum',
        isPrimary: false,
        isNullable: false,
        enumValues: ['active', 'inactive'],
      });
    });

    it('should process relation columns correctly', () => {
      const getColumnMetadata = (service as any).getColumnMetadata.bind(service);
      const mockMetadata = {
        columns: [],
        relations: [
          {
            joinColumns: [
              {
                databaseName: 'user_id',
              },
            ],
            isNullable: true,
            inverseEntityMetadata: {
              tableName: 'user',
            },
            relationType: 'many-to-one',
          },
        ],
      } as unknown as EntityMetadata;

      const result = getColumnMetadata(mockMetadata);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'user_id',
        dataType: ColumnDataType.RELATION,
        rawType: 'relation',
        isPrimary: false,
        isNullable: true,
        relationTarget: 'user',
        relationType: 'many-to-one',
      });
    });

    it('should handle empty metadata', () => {
      const getColumnMetadata = (service as any).getColumnMetadata.bind(service);
      const mockMetadata = {
        columns: [],
        relations: [],
      } as unknown as EntityMetadata;

      const result = getColumnMetadata(mockMetadata);

      expect(result).toHaveLength(0);
    });
  });

  describe('getTables', () => {
    it('should handle empty entity metadatas', async () => {
      Object.defineProperty(mockDataSource, 'entityMetadatas', {
        get: () => [],
        configurable: true,
      });

      const result = await service.getTables();

      expect(result).toEqual({ tables: [] });
    });

    it('should handle query errors gracefully', async () => {
      const mockQueryRunner = {
        query: jest.fn().mockRejectedValue(new Error('Database error')),
        release: jest.fn(),
      };

      mockDataSource.createQueryRunner = jest.fn().mockReturnValue(mockQueryRunner);
      Object.defineProperty(mockDataSource, 'entityMetadatas', {
        get: () => [
          {
            tableName: 'test_table',
            name: 'TestEntity',
            primaryColumns: [{ propertyName: 'id' }],
          },
        ] as unknown as EntityMetadata[],
        configurable: true,
      });

      const result = await service.getTables();

      expect(result.tables).toHaveLength(1);
      expect(result.tables[0]).toEqual({
        name: 'test_table',
        entityName: 'TestEntity',
        recordCount: 0,
        primaryKey: 'id',
      });
      
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});