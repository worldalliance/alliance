import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiResponse } from "@nestjs/swagger";
import type { JwtRequest } from "src/auth/tokens";
import { AdminGuard } from "../auth/guards/admin.guard";
import { AuthGuard } from "../auth/guards/auth.guard";
import {
  CreateGeneralUpdateDto,
  GeneralUpdateAdminDto,
  GeneralUpdateDto,
  UpdateGeneralUpdateDto,
} from "./dto/general-update.dto";
import { GeneralUpdatesService } from "./general-updates.service";

@Controller("actions")
export class GeneralUpdatesController {
  constructor(private readonly generalUpdates: GeneralUpdatesService) {}

  @Get("generalUpdates")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [GeneralUpdateDto] })
  async allGeneralUpdates(): Promise<GeneralUpdateDto[]> {
    return (await this.generalUpdates.findAllGeneralUpdates()).map(
      (generalUpdate) => new GeneralUpdateDto(generalUpdate),
    );
  }

  @Get("generalUpdates/unread")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [GeneralUpdateDto] })
  async unreadGeneralUpdates(
    @Request() req: JwtRequest,
  ): Promise<GeneralUpdateDto[]> {
    return (
      await this.generalUpdates.findUnreadGeneralUpdates({
        userId: req.user.sub,
        now: new Date(),
        allowExpired: false,
      })
    ).map((generalUpdate) => new GeneralUpdateDto(generalUpdate));
  }

  @Post("generalUpdates/:generalUpdateId/dismiss")
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async dismissGeneralUpdate(
    @Request() req: JwtRequest,
    @Param("generalUpdateId", ParseIntPipe) generalUpdateId: number,
  ): Promise<void> {
    return this.generalUpdates.dismissGeneralUpdate(
      req.user.sub,
      generalUpdateId,
    );
  }

  @Get("generalUpdates/admin")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [GeneralUpdateAdminDto] })
  async allGeneralUpdatesAdmin(): Promise<GeneralUpdateAdminDto[]> {
    return (await this.generalUpdates.findAllGeneralUpdatesAdmin()).map(
      (generalUpdate) => new GeneralUpdateAdminDto(generalUpdate),
    );
  }

  @Get("generalUpdates/admin/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: GeneralUpdateAdminDto })
  async findOneGeneralUpdateAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<GeneralUpdateAdminDto> {
    return new GeneralUpdateAdminDto(
      await this.generalUpdates.findOneGeneralUpdate(id),
    );
  }

  @Post("generalUpdates/create")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: GeneralUpdateAdminDto })
  async createGeneralUpdateAdmin(
    @Body() dto: CreateGeneralUpdateDto,
  ): Promise<GeneralUpdateAdminDto> {
    return new GeneralUpdateAdminDto(
      await this.generalUpdates.createGeneralUpdate(dto),
    );
  }

  @Patch("generalUpdates/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: GeneralUpdateAdminDto })
  @ApiResponse({
    status: 409,
    description:
      "The general update was changed by someone else since it was opened (optimistic-concurrency conflict).",
  })
  async updateGeneralUpdateAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateGeneralUpdateDto,
  ): Promise<GeneralUpdateAdminDto> {
    return new GeneralUpdateAdminDto(
      await this.generalUpdates.updateGeneralUpdate(id, dto),
    );
  }
}
