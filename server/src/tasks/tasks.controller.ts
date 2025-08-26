import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { AuthGuard, JwtRequest } from 'src/auth/guards/auth.guard';
import { CreateFormDto, FormDto, SubmitFormDto } from './form.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('submitForm/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async submitForm(
    @Request() req: JwtRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SubmitFormDto,
  ) {
    return this.tasksService.submitForm(+id, req.user.sub, body);
  }

  @Post('createForm')
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async createForm(@Body() body: CreateFormDto) {
    return this.tasksService.createForm(body);
  }

  @Get('listForms')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [FormDto] })
  async listForms(): Promise<FormDto[]> {
    return this.tasksService.listForms();
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: FormDto })
  async getForm(@Param('id', ParseIntPipe) id: number) {
    return this.tasksService.getForm(id);
  }

  @Put('updateForm/:formId')
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async updateForm(
    @Param('formId') formId: string,
    @Body() body: CreateFormDto,
  ) {
    return this.tasksService.updateForm(+formId, body);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @ApiOperation({ operationId: 'deleteForm' })
  @ApiOkResponse()
  async deleteForm(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.tasksService.deleteForm(id);
  }
}
