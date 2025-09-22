import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminViewerService } from './admin-viewer.service';
import {
  DeleteRecordsDto,
  DeleteRecordsResponseDto,
} from './dto/delete-records.dto';
import { TableDataDto, TableDataQueryDto } from './dto/table-data.dto';
import { TableListDto } from './dto/table-list.dto';
import {
  UpdateRecordDto,
  UpdateRecordResponseDto,
} from './dto/update-record.dto';
import {
  CreateRecordDto,
  CreateRecordResponseDto,
} from './dto/create-record.dto';

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
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidUnknownValues: true,
    }),
  )
  getTableData(
    @Param('tableName') tableName: string,
    @Query() query: TableDataQueryDto,
  ): Promise<TableDataDto> {
    return this.adminViewerService.getTableData(tableName, query);
  }

  @Post('tables/:tableName/records')
  @ApiParam({ name: 'tableName', description: 'Name of the database table' })
  @ApiBody({ type: CreateRecordDto })
  @ApiOkResponse({ type: CreateRecordResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid create data or validation failed',
  })
  @ApiNotFoundResponse({ description: 'Table not found' })
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidUnknownValues: true,
    }),
  )
  createRecord(
    @Param('tableName') tableName: string,
    @Body() createData: CreateRecordDto,
  ): Promise<CreateRecordResponseDto> {
    return this.adminViewerService.createRecord(tableName, createData);
  }

  @Put('tables/:tableName/records')
  @ApiParam({ name: 'tableName', description: 'Name of the database table' })
  @ApiBody({ type: UpdateRecordDto })
  @ApiOkResponse({ type: UpdateRecordResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid update data or validation failed',
  })
  @ApiNotFoundResponse({ description: 'Table or record not found' })
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidUnknownValues: true,
    }),
  )
  updateRecord(
    @Param('tableName') tableName: string,
    @Body() updateData: UpdateRecordDto,
  ): Promise<UpdateRecordResponseDto> {
    return this.adminViewerService.updateRecord(tableName, updateData);
  }

  @Delete('tables/:tableName/records')
  @ApiParam({ name: 'tableName', description: 'Name of the database table' })
  @ApiBody({ type: DeleteRecordsDto })
  @ApiOkResponse({ type: DeleteRecordsResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid delete data or validation failed',
  })
  @ApiNotFoundResponse({ description: 'Table not found' })
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidUnknownValues: true,
    }),
  )
  deleteRecords(
    @Param('tableName') tableName: string,
    @Body() deleteData: DeleteRecordsDto,
  ): Promise<DeleteRecordsResponseDto> {
    return this.adminViewerService.deleteRecords(tableName, deleteData);
  }
}
