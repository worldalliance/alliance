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
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { ActionActivityDto, OptOutActionDto } from 'src/actions/dto/action.dto';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import {
  AuthGuard,
  extractGuestTokenFromCookie,
  extractGuestTokenFromHeader,
} from 'src/auth/guards/auth.guard';
import type { JwtRequest } from 'src/auth/guards/jwtreq';
import { Public } from 'src/auth/public.decorator';
import { AuthService } from 'src/auth/auth.service';
import type { Request as ExpressRequest, Response } from 'express';
import {
  CreateCustomValidatorDto,
  CreateCustomValidatorResponseDto,
  CustomValidatorDto,
  CustomValidatorResponseDto,
  CustomValidatorTypeDto,
  RunValidatorDto,
  TestCustomExpressionDto,
  TestCustomExpressionResponseDto,
} from './customvalidator.dto';
import {
  CreateFormDto,
  FormAggregateViewsDto,
  FormDto,
  FormResponseDto,
  GuestFormResponseDto,
  LinkedGuestDraftDto,
  SubmitFollowUpFormDto,
  SubmitFormDto,
} from './form.dto';
import { TasksService } from './tasks.service';

const GUEST_TOKEN_RESPONSE_HEADER = 'X-Guest-Token';

@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly authService: AuthService,
  ) {}

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
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SubmitFormDto,
  ): Promise<FormResponseDto> {
    const authenticatedUserId =
      await this.authService.getAuthenticatedUserId(req);
    if (authenticatedUserId !== null) {
      throw new BadRequestException(
        'Authenticated users must use /tasks/submitForm/:id',
      );
    }
    const incomingToken =
      extractGuestTokenFromHeader(req) ?? extractGuestTokenFromCookie(req);
    const { guestId, guestToken } =
      await this.authService.createGuestSession(incomingToken);
    this.authService.setGuestCookie(res, guestToken);
    res.setHeader(GUEST_TOKEN_RESPONSE_HEADER, guestToken);
    return this.tasksService.submitFormPublic({
      formId: +id,
      submitFormDto: body,
      guestId,
    });
  }

  @Post('submitFollowUpForm/:followUpFormId')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: FormResponseDto })
  async submitFollowUpForm(
    @Request() req: JwtRequest,
    @Param('followUpFormId', ParseIntPipe) followUpFormId: number,
    @Body() body: SubmitFollowUpFormDto,
  ): Promise<FormResponseDto> {
    return this.tasksService.submitFollowUpForm(
      followUpFormId,
      req.user.sub,
      body,
    );
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
  async getFormResponses(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FormResponseDto[]> {
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

  @Get('guestResponse/:id')
  @Public()
  @ApiOkResponse({ type: GuestFormResponseDto })
  async getGuestFormResponse(
    @Request() req: ExpressRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<GuestFormResponseDto> {
    const token =
      extractGuestTokenFromHeader(req) ?? extractGuestTokenFromCookie(req);
    const guestPayload = token
      ? await this.authService.verifyGuestToken(token)
      : null;
    if (!guestPayload) {
      return {};
    }
    return this.tasksService.getGuestFormResponse(guestPayload.sub, id);
  }

  @Get('draft/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: LinkedGuestDraftDto })
  async getLinkedGuestDraft(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: JwtRequest,
  ): Promise<LinkedGuestDraftDto> {
    return this.tasksService.getLinkedGuestDraftFormResponse(req.user.sub, id);
  }

  @Get('slug/:id')
  @ApiOkResponse({ type: FormDto })
  async getForm(@Param('id', ParseIntPipe) id: number): Promise<FormDto> {
    return await this.tasksService.getForm(id);
  }

  @Get('aggregateViews/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: FormAggregateViewsDto })
  async getFormAggregateViews(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FormAggregateViewsDto> {
    return this.tasksService.findFormAggregateViews(id);
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
    const validator = await this.tasksService.findOrCreateCustomValidator(
      body.type,
      body.idArgument,
      body.expression,
    );
    return validator;
  }

  @Post('testCustomExpression')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: TestCustomExpressionResponseDto })
  async testCustomExpression(
    @Body() body: TestCustomExpressionDto,
  ): Promise<TestCustomExpressionResponseDto> {
    return this.tasksService.testCustomExpression(body.expression, body.userId);
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

  @Post('formsForUserSID/:userId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [FormResponseDto] })
  async getFormsForUserSID(@Param('userId', ParseIntPipe) userId: number) {
    return this.tasksService.getFormsForUserSID(userId);
  }
}
