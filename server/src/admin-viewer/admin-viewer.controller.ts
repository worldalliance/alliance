import { Controller, Get, Param, Query, UseGuards, ValidationPipe, UsePipes } from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiParam, ApiQuery, ApiBadRequestResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { AdminViewerService } from './admin-viewer.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { TableListDto } from './dto/table-list.dto';
import { TableDataDto, TableDataQueryDto } from './dto/table-data.dto';

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
}
