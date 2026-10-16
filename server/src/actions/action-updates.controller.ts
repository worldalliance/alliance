import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiResponse } from "@nestjs/swagger";
import type { JwtRequest } from "src/auth/tokens";
import { AdminGuard } from "../auth/guards/admin.guard";
import { AuthGuard } from "../auth/guards/auth.guard";
import { ActionsService } from "./actions.service";
import {
  AdminActionUpdateDto,
  RecognitionPreviewAudienceDto,
  RecognitionPreviewCountsDto,
} from "./dto/action-update-recognition.dto";
import {
  ActionUpdateDto,
  CreateActionUpdateDto,
  UpdateActionUpdateDto,
} from "./dto/action.dto";

@Controller("actions")
export class ActionUpdatesController {
  constructor(private readonly actionsService: ActionsService) {}

  @Post("createUpdate/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: AdminActionUpdateDto })
  async createUpdateAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() createActionUpdateDto: CreateActionUpdateDto,
  ): Promise<AdminActionUpdateDto> {
    return new AdminActionUpdateDto(
      await this.actionsService.createActionUpdate(id, createActionUpdateDto),
    );
  }

  @Get("updates/admin/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: AdminActionUpdateDto })
  async findOneUpdateAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<AdminActionUpdateDto> {
    return new AdminActionUpdateDto(
      await this.actionsService.findOneActionUpdate(id),
    );
  }

  @Patch("updateUpdate/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: AdminActionUpdateDto })
  @ApiResponse({
    status: 409,
    description:
      "The update was changed by someone else since the editor loaded it.",
  })
  async updateUpdateAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateActionUpdateDto: UpdateActionUpdateDto,
  ): Promise<AdminActionUpdateDto> {
    return new AdminActionUpdateDto(
      await this.actionsService.updateActionUpdate(id, updateActionUpdateDto),
    );
  }

  @Post("updates/:id/notify")
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AdminActionUpdateDto })
  @ApiResponse({
    status: 409,
    description: "The update has already been notified about.",
  })
  async notifyUpdateAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<AdminActionUpdateDto> {
    return new AdminActionUpdateDto(
      await this.actionsService.notifyActionUpdate(id),
    );
  }

  @Post("updates/:id/recognition-preview-counts")
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: RecognitionPreviewCountsDto })
  async previewUpdateRecognitionCountsAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() audience: RecognitionPreviewAudienceDto,
  ): Promise<RecognitionPreviewCountsDto> {
    return new RecognitionPreviewCountsDto(
      await this.actionsService.previewActionUpdateRecognitionCounts(id, {
        notifyType: audience.notifyType,
        tagId: audience.tagId ?? null,
      }),
    );
  }

  @Post("updates/:id/unpublish")
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AdminActionUpdateDto })
  @ApiResponse({
    status: 400,
    description:
      "The update is unpublished already, or its displayed date has passed.",
  })
  async unpublishUpdateAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<AdminActionUpdateDto> {
    return new AdminActionUpdateDto(
      await this.actionsService.unpublishActionUpdateUntilDate(id),
    );
  }

  @Post("updates/:id/publish-now")
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AdminActionUpdateDto })
  @ApiResponse({
    status: 400,
    description: "The update is not waiting on a future date.",
  })
  async publishUpdateNowAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<AdminActionUpdateDto> {
    return new AdminActionUpdateDto(
      await this.actionsService.publishActionUpdateNow(id),
    );
  }

  @Delete("deleteUpdate/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteUpdateAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<void> {
    await this.actionsService.deleteActionUpdate(id);
  }

  @Get("allUpdates")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionUpdateDto, isArray: true })
  async allUpdates(@Request() req: JwtRequest): Promise<ActionUpdateDto[]> {
    const updates = await this.actionsService.getActionUpdates(
      undefined,
      req.user.sub,
    );
    return updates.map((update) => new ActionUpdateDto(update));
  }

  @Get("updates")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionUpdateDto, isArray: true })
  async recentUpdates(
    @Request() req: JwtRequest,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<ActionUpdateDto[]> {
    const updates = await this.actionsService.getActionUpdates(
      limit ?? 20,
      req.user.sub,
    );
    return updates.map((update) => new ActionUpdateDto(update));
  }
}
