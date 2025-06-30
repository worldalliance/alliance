import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityMetadata } from 'typeorm';
import { TableListDto, TableMetadataDto } from './dto/table-list.dto';
import { TableDataDto, TableDataQueryDto } from './dto/table-data.dto';
import { ColumnMetadataDto } from './dto/column-metadata.dto';
import { ColumnDataType } from './dto/column-type.enum';
import { UpdateRecordDto, UpdateRecordResponseDto } from './dto/update-record.dto';

@Injectable()
export class AdminViewerService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async getTables(): Promise<TableListDto> {
    const entityMetadatas = this.dataSource.entityMetadatas;
    const tables: TableMetadataDto[] = [];

    for (const metadata of entityMetadatas) {
      const queryRunner = this.dataSource.createQueryRunner();
      try {
        const countResult = await queryRunner.query(
          `SELECT COUNT(*) as count FROM "${metadata.tableName}"`,
        );
        const recordCount = parseInt(countResult[0].count);

        tables.push({
          name: metadata.tableName,
          entityName: metadata.name,
          recordCount,
          primaryKey: metadata.primaryColumns[0]?.propertyName || 'id',
        });
      } catch (error) {
        console.warn(
          `Could not get count for table ${metadata.tableName}:`,
          error,
        );
        tables.push({
          name: metadata.tableName,
          entityName: metadata.name,
          recordCount: 0,
          primaryKey: metadata.primaryColumns[0]?.propertyName || 'id',
        });
      } finally {
        await queryRunner.release();
      }
    }

    return { tables: tables.sort((a, b) => a.name.localeCompare(b.name)) };
  }

  async getTableData(
    tableName: string,
    query: TableDataQueryDto,
  ): Promise<TableDataDto> {
    const metadata = this.dataSource.entityMetadatas.find(
      (m) => m.tableName === tableName,
    );

    if (!metadata) {
      throw new NotFoundException(`Table ${tableName} not found`);
    }

    const columns = this.getColumnMetadata(metadata);
    const { page = 1, limit = 50, sortBy, sortOrder = 'ASC', search } = query;
    const offset = (page - 1) * limit;

    const queryRunner = this.dataSource.createQueryRunner();
    try {
      // Build base query
      let baseQuery = `SELECT * FROM "${tableName}"`;
      const params: (string | number)[] = [];

      // Add search functionality
      if (search) {
        const searchableColumns = columns
          .filter(
            (col) =>
              col.dataType === ColumnDataType.STRING ||
              col.dataType === ColumnDataType.UUID ||
              col.dataType === ColumnDataType.ENUM,
          )
          .map((col) => `"${col.name}"::text ILIKE $${params.length + 1}`)
          .join(' OR ');

        if (searchableColumns) {
          baseQuery += ` WHERE ${searchableColumns}`;
          params.push(`%${search}%`);
        }
      }

      // Add sorting
      if (sortBy && columns.find((col) => col.name === sortBy)) {
        baseQuery += ` ORDER BY "${sortBy}" ${sortOrder}`;
      } else {
        // Default sort by primary key
        const primaryColumn = metadata.primaryColumns[0]?.databaseName || 'id';
        baseQuery += ` ORDER BY "${primaryColumn}" ${sortOrder}`;
      }

      // Add pagination
      baseQuery += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      // Execute main query
      const rows = await queryRunner.query(baseQuery, params);

      // Get total count
      let countQuery = `SELECT COUNT(*) as count FROM "${tableName}"`;
      const countParams: (string | number)[] = [];

      if (search) {
        const searchableColumns = columns
          .filter(
            (col) =>
              col.dataType === ColumnDataType.STRING ||
              col.dataType === ColumnDataType.UUID ||
              col.dataType === ColumnDataType.ENUM,
          )
          .map((col) => `"${col.name}"::text ILIKE $${countParams.length + 1}`)
          .join(' OR ');

        if (searchableColumns) {
          countQuery += ` WHERE ${searchableColumns}`;
          countParams.push(`%${search}%`);
        }
      }

      const countResult = await queryRunner.query(countQuery, countParams);
      const totalCount = parseInt(countResult[0].count);

      // Convert rows to array format
      const rowsArray = rows.map((row: unknown[]) =>
        columns.map((col) => row[col.name]),
      );

      return {
        columns,
        rows: rowsArray,
        totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      };
    } finally {
      await queryRunner.release();
    }
  }

  async updateRecord(
    tableName: string,
    updateData: UpdateRecordDto,
  ): Promise<UpdateRecordResponseDto> {
    const metadata = this.dataSource.entityMetadatas.find(
      (m) => m.tableName === tableName,
    );

    if (!metadata) {
      throw new NotFoundException(`Table ${tableName} not found`);
    }

    const columns = this.getColumnMetadata(metadata);
    const primaryKeyColumn = metadata.primaryColumns[0];
    
    if (!primaryKeyColumn) {
      throw new NotFoundException(`No primary key found for table ${tableName}`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      // Start transaction
      await queryRunner.startTransaction();

      // First, verify the record exists
      const existingRecord = await queryRunner.query(
        `SELECT * FROM "${tableName}" WHERE "${primaryKeyColumn.databaseName}" = $1`,
        [updateData.primaryKeyValue],
      );

      if (!existingRecord || existingRecord.length === 0) {
        throw new NotFoundException(`Record with ID ${updateData.primaryKeyValue} not found in table ${tableName}`);
      }

      // Validate and sanitize the updates
      const sanitizedUpdates: Record<string, any> = {};
      const updateColumns: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      for (const [columnName, value] of Object.entries(updateData.updates)) {
        // Find column metadata
        const columnMeta = columns.find(col => col.name === columnName);
        
        if (!columnMeta) {
          throw new Error(`Column ${columnName} not found in table ${tableName}`);
        }

        // Skip primary key updates
        if (columnMeta.isPrimary) {
          continue;
        }

        // Skip relation columns for now
        if (columnMeta.dataType === ColumnDataType.RELATION) {
          continue;
        }

        // Validate and convert value based on data type
        const convertedValue = this.convertValueForDatabase(value, columnMeta);
        
        if (convertedValue !== undefined) {
          updateColumns.push(`"${columnName}" = $${paramIndex}`);
          updateValues.push(convertedValue);
          sanitizedUpdates[columnName] = convertedValue;
          paramIndex++;
        }
      }

      if (updateColumns.length === 0) {
        return {
          success: false,
          message: 'No valid columns to update',
        };
      }

      // Add primary key for WHERE clause
      updateValues.push(updateData.primaryKeyValue);

      // Build and execute update query
      const updateQuery = `
        UPDATE "${tableName}" 
        SET ${updateColumns.join(', ')} 
        WHERE "${primaryKeyColumn.databaseName}" = $${paramIndex}
        RETURNING *
      `;

      const result = await queryRunner.query(updateQuery, updateValues);
      
      // Commit transaction
      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Record updated successfully',
        updatedRecord: result[0],
      };
    } catch (error) {
      // Rollback transaction on error
      await queryRunner.rollbackTransaction();
      
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      throw new Error(`Failed to update record: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  private convertValueForDatabase(value: any, columnMeta: ColumnMetadataDto): any {
    // Handle null values
    if (value === null || value === undefined || value === '') {
      return columnMeta.isNullable ? null : undefined;
    }

    switch (columnMeta.dataType) {
      case ColumnDataType.STRING:
      case ColumnDataType.UUID:
        return String(value);

      case ColumnDataType.NUMBER:
        const numValue = Number(value);
        return isNaN(numValue) ? undefined : numValue;

      case ColumnDataType.BOOLEAN:
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          const lower = value.toLowerCase();
          if (lower === 'true' || lower === '1') return true;
          if (lower === 'false' || lower === '0') return false;
        }
        return Boolean(value);

      case ColumnDataType.DATE:
      case ColumnDataType.DATETIME:
        if (value instanceof Date) return value;
        const dateValue = new Date(value);
        return isNaN(dateValue.getTime()) ? undefined : dateValue;

      case ColumnDataType.JSON:
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return undefined;
          }
        }
        return value;

      case ColumnDataType.ENUM:
        // Validate enum value
        if (columnMeta.enumValues && !columnMeta.enumValues.includes(value)) {
          throw new Error(`Invalid enum value "${value}" for column ${columnMeta.name}. Valid values: ${columnMeta.enumValues.join(', ')}`);
        }
        return String(value);

      default:
        return value;
    }
  }

  private mapColumnType(typeormType: string): ColumnDataType {
    const type = typeormType.toString().toLowerCase();

    // JavaScript constructor function mappings (for TypeORM function types)
    if (type === 'number') {
      return ColumnDataType.NUMBER;
    }
    if (type === 'string') {
      return ColumnDataType.STRING;
    }
    if (type === 'boolean') {
      return ColumnDataType.BOOLEAN;
    }
    if (type === 'date') {
      return ColumnDataType.DATETIME;
    }

    // String types
    if (
      [
        'varchar',
        'text',
        'char',
        'character',
        'character varying',
        'citext',
      ].includes(type)
    ) {
      return ColumnDataType.STRING;
    }

    // Number types
    if (
      [
        'int',
        'int2',
        'int4',
        'int8',
        'integer',
        'bigint',
        'smallint',
        'decimal',
        'numeric',
        'real',
        'double',
        'double precision',
        'float',
        'float4',
        'float8',
        'money',
        'serial',
        'bigserial',
        'smallserial',
      ].includes(type)
    ) {
      return ColumnDataType.NUMBER;
    }

    // Boolean types
    if (['boolean', 'bool'].includes(type)) {
      return ColumnDataType.BOOLEAN;
    }

    // Date types (only pure date, not datetime)
    if (['dateonly'].includes(type)) {
      return ColumnDataType.DATE;
    }

    // DateTime types
    if (
      [
        'timestamp',
        'timestamptz',
        'timestamp without time zone',
        'timestamp with time zone',
        'datetime',
        'time',
        'timetz',
        'time without time zone',
        'time with time zone',
      ].includes(type)
    ) {
      return ColumnDataType.DATETIME;
    }

    // JSON types
    if (['json', 'jsonb'].includes(type)) {
      return ColumnDataType.JSON;
    }

    // UUID types
    if (['uuid'].includes(type)) {
      return ColumnDataType.UUID;
    }

    // Enum types
    if (type === 'enum') {
      return ColumnDataType.ENUM;
    }

    return ColumnDataType.UNKNOWN;
  }

  private getColumnMetadata(metadata: EntityMetadata): ColumnMetadataDto[] {
    const columns: ColumnMetadataDto[] = [];

    // Add regular columns
    for (const column of metadata.columns) {
      // Handle different types of column.type values
      let rawType: string;

      if (typeof column.type === 'function') {
        // Handle constructor functions like Number, String, Boolean
        rawType = column.type.name.toLowerCase();
      } else if (typeof column.type === 'string') {
        rawType = column.type;
      } else {
        // Fallback for other types
        rawType = String(column.type);
      }

      const dataType = this.mapColumnType(rawType);

      columns.push({
        name: column.databaseName,
        dataType,
        rawType,
        isPrimary: column.isPrimary,
        isNullable: column.isNullable,
        enumValues: column.enum
          ? Object.values(column.enum as object)
          : undefined,
      });
    }

    // Add relation columns
    for (const relation of metadata.relations) {
      if (relation.joinColumns && relation.joinColumns.length > 0) {
        // Foreign key columns
        for (const joinColumn of relation.joinColumns) {
          columns.push({
            name: joinColumn.databaseName,
            dataType: ColumnDataType.RELATION,
            rawType: 'relation',
            isPrimary: false,
            isNullable: relation.isNullable,
            relationTarget: relation.inverseEntityMetadata.tableName,
            relationType: relation.relationType,
          });
        }
      }
    }

    return columns.sort((a, b) => {
      // Primary keys first, then regular columns, then relations
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      if (
        a.dataType === ColumnDataType.RELATION &&
        b.dataType !== ColumnDataType.RELATION
      )
        return 1;
      if (
        a.dataType !== ColumnDataType.RELATION &&
        b.dataType === ColumnDataType.RELATION
      )
        return -1;
      return a.name.localeCompare(b.name);
    });
  }
}
