/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityMetadata } from 'typeorm';
import { ColumnMetadataDto } from './dto/column-metadata.dto';
import { ColumnDataType } from './dto/column-type.enum';
import {
  DeleteRecordsDto,
  DeleteRecordsResponseDto,
} from './dto/delete-records.dto';
import {
  CreateRecordDto,
  CreateRecordResponseDto,
} from './dto/create-record.dto';
import { TableDataDto, TableDataQueryDto } from './dto/table-data.dto';
import { TableListDto, TableMetadataDto } from './dto/table-list.dto';
import {
  UpdateRecordDto,
  UpdateRecordResponseDto,
} from './dto/update-record.dto';

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
      let countQuery = `SELECT COUNT(*) as count FROM "${tableName}"`;

      const whereClauses: string[] = [];
      const whereParams: (string | number | boolean)[] = [];

      let remainingSearch = search;

      if (search) {
        const columnFilter = this.parseColumnFilter(search, columns);
        if (columnFilter) {
          const filterClause = this.buildColumnFilterCondition(
            columnFilter.column,
            columnFilter.value,
            whereParams,
          );

          if (filterClause) {
            whereClauses.push(filterClause);
            remainingSearch = undefined;
          }
        }
      }

      if (remainingSearch) {
        const searchableColumnsList = columns.filter(
          (col) =>
            col.dataType === ColumnDataType.STRING ||
            col.dataType === ColumnDataType.UUID ||
            col.dataType === ColumnDataType.ENUM,
        );

        if (searchableColumnsList.length > 0) {
          const placeholderIndex = whereParams.length + 1;
          const searchableColumns = searchableColumnsList
            .map((col) => `"${col.name}"::text ILIKE $${placeholderIndex}`)
            .join(' OR ');

          whereClauses.push(`(${searchableColumns})`);
          whereParams.push(`%${remainingSearch}%`);
        }
      }

      if (whereClauses.length > 0) {
        const whereSql = whereClauses.join(' AND ');
        baseQuery += ` WHERE ${whereSql}`;
        countQuery += ` WHERE ${whereSql}`;
      }

      // Add sorting
      if (sortBy && columns.find((col) => col.name === sortBy)) {
        baseQuery += ` ORDER BY "${sortBy}" ${sortOrder}`;
      } else {
        // Default sort by primary key
        const primaryColumn = metadata.primaryColumns[0]?.databaseName || 'id';
        baseQuery += ` ORDER BY "${primaryColumn}" ${sortOrder}`;
      }

      const dataParams = [...whereParams];
      // Add pagination
      baseQuery += ` LIMIT $${dataParams.length + 1} OFFSET $${dataParams.length + 2}`;
      dataParams.push(limit, offset);

      // Execute main query
      const rows = await queryRunner.query(baseQuery, dataParams);

      const countParams = [...whereParams];
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

  async createRecord(
    tableName: string,
    createData: CreateRecordDto,
  ): Promise<CreateRecordResponseDto> {
    const metadata = this.dataSource.entityMetadatas.find(
      (m) => m.tableName === tableName,
    );

    if (!metadata) {
      throw new NotFoundException(`Table ${tableName} not found`);
    }

    const columns = this.getColumnMetadata(metadata);

    if (!createData.record || Object.keys(createData.record).length === 0) {
      return {
        success: false,
        message: 'No data provided to create a record',
      };
    }

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.startTransaction();

      const columnNames: string[] = [];
      const valuePlaceholders: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      for (const [columnName, value] of Object.entries(createData.record)) {
        const normalizedName = columnName.toLowerCase();
        if (
          normalizedName === 'datecreated' ||
          normalizedName === 'dateupdated'
        ) {
          continue;
        }

        const columnMeta = columns.find((col) => col.name === columnName);

        if (!columnMeta) {
          throw new Error(
            `Column ${columnName} not found in table ${tableName}`,
          );
        }

        const convertedValue = this.convertValueForDatabase(value, columnMeta);

        if (convertedValue !== undefined) {
          columnNames.push(`"${columnName}"`);
          valuePlaceholders.push(`$${paramIndex}`);
          values.push(convertedValue);
          paramIndex++;
        }
      }

      if (columnNames.length === 0) {
        return {
          success: false,
          message: 'No valid columns provided for insertion',
        };
      }

      const insertQuery = `
        INSERT INTO "${tableName}" (${columnNames.join(', ')})
        VALUES (${valuePlaceholders.join(', ')})
        RETURNING *
      `;

      const result = await queryRunner.query(insertQuery, values);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Record created successfully',
        createdRecord: result[0],
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException(`Failed to create record: ${error.message}`);
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
      throw new NotFoundException(
        `No primary key found for table ${tableName}`,
      );
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
        throw new NotFoundException(
          `Record with ID ${updateData.primaryKeyValue} not found in table ${tableName}`,
        );
      }

      // Validate and sanitize the updates
      const sanitizedUpdates: Record<string, any> = {};
      const updateColumns: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      for (const [columnName, value] of Object.entries(updateData.updates)) {
        // Find column metadata
        const columnMeta = columns.find((col) => col.name === columnName);

        if (!columnMeta) {
          throw new Error(
            `Column ${columnName} not found in table ${tableName}`,
          );
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

  async deleteRecords(
    tableName: string,
    deleteData: DeleteRecordsDto,
  ): Promise<DeleteRecordsResponseDto> {
    const metadata = this.dataSource.entityMetadatas.find(
      (m) => m.tableName === tableName,
    );

    if (!metadata) {
      throw new NotFoundException(`Table ${tableName} not found`);
    }

    const primaryKeyColumn = metadata.primaryColumns[0];

    if (!primaryKeyColumn) {
      throw new NotFoundException(
        `No primary key found for table ${tableName}`,
      );
    }

    if (
      !deleteData.primaryKeyValues ||
      deleteData.primaryKeyValues.length === 0
    ) {
      return {
        success: false,
        message: 'No records specified for deletion',
        deletedCount: 0,
        deletedIds: [],
      };
    }

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      // Start transaction
      await queryRunner.startTransaction();

      // First, verify which records exist
      const placeholders = deleteData.primaryKeyValues
        .map((_, index) => `$${index + 1}`)
        .join(', ');
      const selectQuery = `SELECT "${primaryKeyColumn.databaseName}" FROM "${tableName}" WHERE "${primaryKeyColumn.databaseName}" IN (${placeholders})`;

      const existingRecords = await queryRunner.query(
        selectQuery,
        deleteData.primaryKeyValues,
      );
      const existingIds = existingRecords.map(
        (record) => record[primaryKeyColumn.databaseName],
      );

      if (existingIds.length === 0) {
        await queryRunner.rollbackTransaction();
        return {
          success: false,
          message: 'No matching records found to delete',
          deletedCount: 0,
          deletedIds: [],
          failedIds: deleteData.primaryKeyValues,
        };
      }

      // Delete the records
      const deleteQuery = `DELETE FROM "${tableName}" WHERE "${primaryKeyColumn.databaseName}" IN (${placeholders}) RETURNING "${primaryKeyColumn.databaseName}"`;
      const result = await queryRunner.query(
        deleteQuery,
        deleteData.primaryKeyValues,
      );

      // The result is an array where the first element is the actual records, second is row count
      const deletedRecords = Array.isArray(result[0]) ? result[0] : result;
      const deletedIds = deletedRecords.map(
        (record) => record[primaryKeyColumn.databaseName],
      );

      const failedIds = deleteData.primaryKeyValues.filter(
        (id) =>
          !deletedIds.some((deletedId) => String(deletedId) === String(id)),
      );

      // Commit transaction
      await queryRunner.commitTransaction();

      return {
        success: true,
        message: `Successfully deleted ${deletedIds.length} record${deletedIds.length === 1 ? '' : 's'}`,
        deletedCount: deletedIds.length,
        deletedIds,
        failedIds: failedIds.length > 0 ? failedIds : undefined,
      };
    } catch (error) {
      // Rollback transaction on error
      await queryRunner.rollbackTransaction();

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new Error(`Failed to delete records: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  private convertValueForDatabase(
    value: any,
    columnMeta: ColumnMetadataDto,
  ): any {
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
        if (this.isTimeOnlyColumn(columnMeta)) {
          const timeValue = this.normalizeTimeForDatabase(value);
          if (timeValue === null) {
            return columnMeta.isNullable ? null : undefined;
          }
          return timeValue;
        }
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
          throw new Error(
            `Invalid enum value "${value}" for column ${columnMeta.name}. Valid values: ${columnMeta.enumValues.join(', ')}`,
          );
        }
        return String(value);

      default:
        return value;
    }
  }

  private isTimeOnlyColumn(columnMeta: ColumnMetadataDto): boolean {
    const rawType = columnMeta.rawType?.toLowerCase() ?? '';
    return rawType.startsWith('time') && !rawType.includes('stamp');
  }

  private normalizeTimeForDatabase(value: any): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (value instanceof Date) {
      return this.normalizeTimeParts(
        value.getUTCHours(),
        value.getUTCMinutes(),
        value.getUTCSeconds(),
      );
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      const literalMatch = trimmed.match(
        /(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?/,
      );
      if (literalMatch) {
        return this.normalizeTimeParts(
          Number(literalMatch[1]),
          Number(literalMatch[2]),
          literalMatch[3] ? Number(literalMatch[3]) : 0,
        );
      }

      const twelveHourMatch = trimmed.match(
        /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i,
      );
      if (twelveHourMatch) {
        const hours = Number(twelveHourMatch[1]);
        const minutes = twelveHourMatch[2] ? Number(twelveHourMatch[2]) : 0;
        if (
          Number.isNaN(hours) ||
          Number.isNaN(minutes) ||
          hours < 1 ||
          hours > 12
        ) {
          return null;
        }
        const meridiem = twelveHourMatch[3].toLowerCase();
        let normalizedHours = hours % 12;
        if (meridiem === 'pm') {
          normalizedHours += 12;
        }
        return this.normalizeTimeParts(normalizedHours, minutes, 0);
      }

      return null;
    }

    if (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { toString?: () => string }).toString === 'function'
    ) {
      const stringValue = (value as { toString: () => string }).toString();
      if (stringValue && stringValue !== '[object Object]') {
        return this.normalizeTimeForDatabase(stringValue);
      }
    }

    return null;
  }

  private normalizeTimeParts(
    hours: number,
    minutes: number,
    seconds: number = 0,
  ): string | null {
    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      Number.isNaN(seconds) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59 ||
      seconds < 0 ||
      seconds > 59
    ) {
      return null;
    }

    const pad = (val: number) => String(val).padStart(2, '0');
    const hh = pad(hours);
    const mm = pad(minutes);
    const ss = pad(seconds);
    return `${hh}:${mm}:${ss}`;
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

  private parseColumnFilter(
    search: string | undefined,
    columns: ColumnMetadataDto[],
  ): { column: ColumnMetadataDto; value: string } | null {
    if (!search) {
      return null;
    }

    const match = search.match(/^\s*([^:]+)\s*:\s*(.+)$/);
    if (!match) {
      return null;
    }

    const [, columnSegment, valueSegment] = match;
    const columnName = columnSegment.trim();
    let rawValue = valueSegment.trim();

    if (!columnName || !rawValue) {
      return null;
    }

    if (
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
    ) {
      rawValue = rawValue.slice(1, -1).trim();
    }

    if (!rawValue) {
      return null;
    }

    const column = columns.find(
      (col) => col.name.toLowerCase() === columnName.toLowerCase(),
    );

    if (!column) {
      return null;
    }

    return { column, value: rawValue };
  }

  private buildColumnFilterCondition(
    column: ColumnMetadataDto,
    rawValue: string,
    params: (string | number | boolean)[],
  ): string | null {
    const trimmedValue = rawValue.trim();
    if (!trimmedValue) {
      return null;
    }

    const normalizedValue = trimmedValue.toLowerCase();
    if (normalizedValue === 'null') {
      return `"${column.name}" IS NULL`;
    }

    switch (column.dataType) {
      case ColumnDataType.NUMBER: {
        const numericValue = Number(trimmedValue);
        if (Number.isNaN(numericValue)) {
          return null;
        }
        params.push(numericValue);
        return `"${column.name}" = $${params.length}`;
      }
      case ColumnDataType.BOOLEAN: {
        if (['true', '1', 'yes', 'y', 't'].includes(normalizedValue)) {
          params.push(true);
          return `"${column.name}" = $${params.length}`;
        }
        if (['false', '0', 'no', 'n', 'f'].includes(normalizedValue)) {
          params.push(false);
          return `"${column.name}" = $${params.length}`;
        }
        return null;
      }
      case ColumnDataType.ENUM: {
        params.push(trimmedValue);
        return `"${column.name}" = $${params.length}`;
      }
      case ColumnDataType.UUID: {
        params.push(trimmedValue);
        return `"${column.name}"::text ILIKE $${params.length}`;
      }
      case ColumnDataType.DATE:
      case ColumnDataType.DATETIME:
      case ColumnDataType.JSON:
      case ColumnDataType.STRING:
      case ColumnDataType.UNKNOWN:
      case ColumnDataType.RELATION: {
        params.push(`%${trimmedValue}%`);
        return `"${column.name}"::text ILIKE $${params.length}`;
      }
      default:
        return null;
    }
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
          const existingIndex = columns.findIndex(
            (col) => col.name === joinColumn.databaseName,
          );

          if (existingIndex >= 0) {
            const existing = columns[existingIndex];
            columns[existingIndex] = {
              ...existing,
              dataType: ColumnDataType.RELATION,
              rawType: 'relation',
              isNullable: relation.isNullable ?? existing.isNullable,
              relationTarget: relation.inverseEntityMetadata.tableName,
              relationType: relation.relationType,
            };
            continue;
          }

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
