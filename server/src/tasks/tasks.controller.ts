import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import type { Request as ExpressRequest, Response } from 'express';
import { ActionActivityDto, OptOutActionDto } from 'src/actions/dto/action.dto';
import { AuthService } from 'src/auth/auth.service';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import {
  AuthGuard,
  extractGuestTokenFromCookie,
  extractGuestTokenFromHeader,
} from 'src/auth/guards/auth.guard';
import type { JwtRequest } from 'src/auth/guards/jwtreq';
import { Public } from 'src/auth/public.decorator';
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
  EditFormResponseDto,
  FormAggregateViewsDto,
  FormDto,
  FormResponseDto,
  FormResponseVersionDto,
  FormSnapshotMigrationDto,
  GuestFormResponseDto,
  LinkedGuestDraftDto,
  MigrateResponseSnapshotsDto,
  MigrateResponseSnapshotsResultDto,
  SubmitFollowUpFormDto,
  SubmitFormDto,
  UpdateFormDto,
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
    return new FormResponseDto({
      response: await this.tasksService.submitForm(+id, req.user.sub, body),
    });
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
    return new FormResponseDto({
      response: await this.tasksService.submitFormPublic({
        formId: +id,
        submitFormDto: body,
        guestId,
      }),
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
    return new FormResponseDto({
      response: await this.tasksService.submitFollowUpForm(
        followUpFormId,
        req.user.sub,
        body,
      ),
    });
  }

  @Post('createForm')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: FormDto })
  async createFormAdmin(@Body() body: CreateFormDto): Promise<FormDto> {
    return new FormDto(await this.tasksService.createForm(body));
  }

  @Get('listForms')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [FormDto] })
  async listFormsAdmin(): Promise<FormDto[]> {
    return this.tasksService.listForms();
  }

  @Get('responses/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [FormResponseDto] })
  async getFormResponsesAdmin(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FormResponseDto[]> {
    return this.tasksService.getFormResponses(id);
  }

  @Get('forms/:formId/snapshotMigration')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: FormSnapshotMigrationDto })
  async getResponseSnapshotMigrationAdmin(
    @Param('formId', ParseIntPipe) formId: number,
  ): Promise<FormSnapshotMigrationDto> {
    return new FormSnapshotMigrationDto(
      await this.tasksService.getResponseSnapshotMigration(formId),
    );
  }

  @Patch('forms/:formId/responseSnapshots')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: MigrateResponseSnapshotsResultDto })
  async migrateResponseSnapshotsAdmin(
    @Param('formId', ParseIntPipe) formId: number,
    @Body() body: MigrateResponseSnapshotsDto,
  ): Promise<MigrateResponseSnapshotsResultDto> {
    return new MigrateResponseSnapshotsResultDto(
      await this.tasksService.migrateResponseSnapshots(
        formId,
        body.responseIds,
        body.targetSnapshotId,
      ),
    );
  }

  @Get('myResponse/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: FormResponseDto })
  async getMyFormResponse(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: JwtRequest,
  ): Promise<FormResponseDto> {
    return new FormResponseDto({
      response: await this.tasksService.getMyFormResponse(req.user.sub, id),
    });
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
      return new GuestFormResponseDto();
    }
    return new GuestFormResponseDto(
      await this.tasksService.getGuestFormResponse(guestPayload.sub, id),
    );
  }

  @Get('draft/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: LinkedGuestDraftDto })
  async getLinkedGuestDraft(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: JwtRequest,
  ): Promise<LinkedGuestDraftDto> {
    return new LinkedGuestDraftDto(
      await this.tasksService.getLinkedGuestDraftFormResponse(req.user.sub, id),
    );
  }

  @Get('slug/:id')
  @ApiOkResponse({ type: FormDto })
  async getForm(@Param('id', ParseIntPipe) id: number): Promise<FormDto> {
    return new FormDto(await this.tasksService.getForm(id));
  }

  @Get('aggregateViews/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: FormAggregateViewsDto })
  async getFormAggregateViews(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FormAggregateViewsDto> {
    return new FormAggregateViewsDto(
      await this.tasksService.findFormAggregateViews(id),
    );
  }

  @Patch('editResponse/:formId')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: FormResponseDto })
  async editFormResponse(
    @Param('formId', ParseIntPipe) formId: number,
    @Body() body: EditFormResponseDto,
    @Request() req: JwtRequest,
  ): Promise<FormResponseDto> {
    return new FormResponseDto({
      response: await this.tasksService.editFormResponse(
        req.user.sub,
        formId,
        body,
      ),
    });
  }

  @Get('responseVersions/:formId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [FormResponseVersionDto] })
  async getResponseVersionsAdmin(
    @Param('formId', ParseIntPipe) formId: number,
  ): Promise<FormResponseVersionDto[]> {
    return this.tasksService.getResponseVersions(formId);
  }

  @Put('updateForm/:formId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: FormDto })
  async updateFormAdmin(
    @Param('formId', ParseIntPipe) formId: number,
    @Body() body: UpdateFormDto,
  ): Promise<FormDto> {
    return new FormDto(await this.tasksService.updateForm(+formId, body));
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteFormAdmin(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.tasksService.deleteForm(id);
  }

  @Get('customValidators')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CustomValidatorTypeDto, isArray: true })
  async customValidatorsAdmin(): Promise<CustomValidatorTypeDto[]> {
    const types = await this.tasksService.customValidators();
    return types.map((t) => new CustomValidatorTypeDto(t));
  }

  @Post('runValidator/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: CustomValidatorResponseDto })
  async runValidator(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: JwtRequest,
    @Body() body: RunValidatorDto,
  ): Promise<CustomValidatorResponseDto> {
    return new CustomValidatorResponseDto(
      await this.tasksService.runValidator(id, req.user.sub, body.fieldValue),
    );
  }

  @Get('findOneCustomValidator/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CustomValidatorDto })
  async findOneCustomValidatorAdmin(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CustomValidatorDto> {
    return new CustomValidatorDto(
      await this.tasksService.findOneCustomValidator(id),
    );
  }

  @Post('createCustomValidator')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CreateCustomValidatorResponseDto })
  async createCustomValidatorAdmin(
    @Body() body: CreateCustomValidatorDto,
  ): Promise<CreateCustomValidatorResponseDto> {
    const validator = await this.tasksService.findOrCreateCustomValidator(
      body.type,
      body.idArgument,
      body.expression,
    );
    return new CreateCustomValidatorResponseDto(validator.id);
  }

  @Post('testCustomExpression')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: TestCustomExpressionResponseDto })
  async testCustomExpressionAdmin(
    @Body() body: TestCustomExpressionDto,
  ): Promise<TestCustomExpressionResponseDto> {
    return new TestCustomExpressionResponseDto(
      await this.tasksService.testCustomExpression(
        body.expression,
        body.userId,
      ),
    );
  }

  @Post('optout/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionActivityDto })
  async optout(
    @Request() req: JwtRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: OptOutActionDto,
  ): Promise<ActionActivityDto> {
    if (!body.partialFormData) {
      throw new BadRequestException('Partial form data is required');
    }
    return new ActionActivityDto(
      await this.tasksService.optoutForm(
        id,
        body.actionId,
        req.user.sub,
        body.reason,
        body.outOfTime,
        body.partialFormData,
      ),
    );
  }

  @Post('formsForUserSID/:userId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [FormResponseDto] })
  async getFormsForUserSIDAdmin(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<FormResponseDto[]> {
    return (await this.tasksService.getFormsForUserSID(userId)).map(
      (response) => new FormResponseDto({ response }),
    );
  }
}
