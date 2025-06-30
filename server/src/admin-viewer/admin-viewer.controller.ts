import { Controller, Get, Put, Param, Query, Body, UseGuards, ValidationPipe, UsePipes } from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiParam, ApiQuery, ApiBadRequestResponse, ApiNotFoundResponse, ApiBody } from '@nestjs/swagger';
import { AdminViewerService } from './admin-viewer.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { TableListDto } from './dto/table-list.dto';
import { TableDataDto, TableDataQueryDto } from './dto/table-data.dto';
import { UpdateRecordDto, UpdateRecordResponseDto } from './dto/update-record.dto';

@ApiTags('admin-viewer')
@Controller('admin-viewer')
@UseGuards(AdminGuard)
export class AdminViewerController {
  constructor(private readonly adminViewerService: AdminViewerService) {}

  @Get('tables')
  @ApiOkResponse({ type: TableListDto })
  getTables(): Promise<TableListDto> {
    return this.adminViewerService.getTables();
  }

  @Get('tables/:tableName/data')
  @ApiParam({ name: 'tableName', description: 'Name of the database table' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiOkResponse({ type: TableDataDto })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  @ApiNotFoundResponse({ description: 'Table not found' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  getTableData(
    @Param('tableName') tableName: string,
    @Query() query: TableDataQueryDto,
  ): Promise<TableDataDto> {
    return this.adminViewerService.getTableData(tableName, query);
  }

  @Put('tables/:tableName/records')
  @ApiParam({ name: 'tableName', description: 'Name of the database table' })
  @ApiBody({ type: UpdateRecordDto })
  @ApiOkResponse({ type: UpdateRecordResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid update data or validation failed' })
  @ApiNotFoundResponse({ description: 'Table or record not found' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  updateRecord(
    @Param('tableName') tableName: string,
    @Body() updateData: UpdateRecordDto,
  ): Promise<UpdateRecordResponseDto> {
    return this.adminViewerService.updateRecord(tableName, updateData);
  }
}
