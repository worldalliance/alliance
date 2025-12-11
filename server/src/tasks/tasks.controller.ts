import {
  BadRequestException,
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
import { ApiOkResponse } from '@nestjs/swagger';
import { ActionActivityDto, OptOutActionDto } from 'src/actions/dto/action.dto';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { AuthGuard, JwtRequest } from 'src/auth/guards/auth.guard';
import { Public } from 'src/auth/public.decorator';
import {
  CreateCustomValidatorDto,
  CreateCustomValidatorResponseDto,
  CustomValidatorDto,
  CustomValidatorResponseDto,
  CustomValidatorTypeDto,
  RunValidatorDto,
} from './customvalidator.dto';
import {
  CreateFormDto,
  FormDto,
  FormResponseDto,
  SubmitFormDto,
} from './form.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('submitForm/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: FormResponseDto })
  async submitForm(
    @Request() req: JwtRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SubmitFormDto,
  ): Promise<FormResponseDto> {
    return this.tasksService.submitForm(+id, req.user.sub, body);
  }

  @Post('submitPublicForm/:id')
  @Public()
  @ApiOkResponse({ type: FormResponseDto })
  async submitPublicForm(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SubmitFormDto,
  ): Promise<FormResponseDto> {
    return this.tasksService.submitFormPublic(+id, body);
  }

  @Post('createForm')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: FormDto })
  async createForm(@Body() body: CreateFormDto) {
    return this.tasksService.createForm(body);
  }

  @Get('listForms')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [FormDto] })
  async listForms(): Promise<FormDto[]> {
    return this.tasksService.listForms();
  }

  @Get('responses/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [FormResponseDto] })
  async getFormResponses(@Param('id', ParseIntPipe) id: number) {
    return this.tasksService.getFormResponses(id);
  }

  @Get('myResponse/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: FormResponseDto })
  async getMyFormResponse(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: JwtRequest,
  ) {
    return this.tasksService.getMyFormResponse(req.user.sub, id);
  }

  @Get('slug/:id')
  @ApiOkResponse({ type: FormDto })
  async getForm(@Param('id', ParseIntPipe) id: number) {
    return this.tasksService.getForm(id);
  }

  @Put('updateForm/:formId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: FormDto })
  async updateForm(
    @Param('formId', ParseIntPipe) formId: number,
    @Body() body: CreateFormDto,
  ) {
    return this.tasksService.updateForm(+formId, body);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteForm(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.tasksService.deleteForm(id);
  }

  @Get('customValidators')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CustomValidatorTypeDto, isArray: true })
  async customValidators() {
    return this.tasksService.customValidators();
  }

  @Post('runValidator/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: CustomValidatorResponseDto })
  async runValidator(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: JwtRequest,
    @Body() body: RunValidatorDto,
  ) {
    return this.tasksService.runValidator(id, req.user.sub, body.fieldValue);
  }

  @Get('findOneCustomValidator/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CustomValidatorDto })
  async findOneCustomValidator(@Param('id', ParseIntPipe) id: number) {
    return this.tasksService.findOneCustomValidator(id);
  }

  @Post('createCustomValidator')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CreateCustomValidatorResponseDto })
  async createCustomValidator(
    @Body() body: CreateCustomValidatorDto,
  ): Promise<CreateCustomValidatorResponseDto> {
    const id = await this.tasksService.findOrCreateCustomValidator(
      body.type,
      body.idArgument,
    );
    return { id };
  }

  @Post('optout/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionActivityDto })
  optout(
    @Request() req: JwtRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: OptOutActionDto,
  ) {
    if (!body.partialFormData) {
      throw new BadRequestException('Partial form data is required');
    }
    return this.tasksService.optoutForm(
      id,
      body.actionId,
      req.user.sub,
      body.reason,
      body.outOfTime,
      body.partialFormData,
    );
  }
}
