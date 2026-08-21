import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";
import { AdminGuard } from "src/auth/guards/admin.guard";
import { Public } from "src/auth/public.decorator";
import { ACTION_PARTNERSHIP_RESPONSE_THROTTLE } from "src/auth/signup-throttle.config";
import { OnlyThrottle } from "src/utils/throttle";
import { ActionPartnershipsService } from "./action-partnerships.service";
import {
  ActionPartnershipNoteDto,
  ActionPartnershipResponseDto,
  CreateActionPartnershipNoteDto,
  CreateActionPartnershipResponseDto,
  CreateActionPartnershipResponseResultDto,
} from "./dto/action-partnership.dto";

@Controller("action-partnerships")
export class ActionPartnershipsController {
  constructor(
    private readonly actionPartnershipsService: ActionPartnershipsService,
  ) {}

  @Post("responses")
  @Public()
  @UseGuards(ThrottlerGuard)
  @OnlyThrottle(ACTION_PARTNERSHIP_RESPONSE_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CreateActionPartnershipResponseResultDto })
  async createResponse(
    @Body() dto: CreateActionPartnershipResponseDto,
  ): Promise<CreateActionPartnershipResponseResultDto> {
    await this.actionPartnershipsService.createResponse(dto);
    return new CreateActionPartnershipResponseResultDto();
  }

  @Get("responses")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionPartnershipResponseDto, isArray: true })
  async findAllResponsesAdmin(): Promise<ActionPartnershipResponseDto[]> {
    const responses =
      await this.actionPartnershipsService.findAllResponsesAdmin();
    return responses.map(
      (response) => new ActionPartnershipResponseDto(response),
    );
  }

  @Post("responses/:id/notes")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionPartnershipNoteDto })
  async createNoteAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateActionPartnershipNoteDto,
  ): Promise<ActionPartnershipNoteDto> {
    return new ActionPartnershipNoteDto(
      await this.actionPartnershipsService.createNoteAdmin(id, dto),
    );
  }

  @Delete("responses/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteResponseAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<void> {
    await this.actionPartnershipsService.deleteResponseAdmin(id);
  }
}
