import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import { ApiNoContentResponse, ApiOkResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import { KoraAdminOverviewDto } from "./dto/kora-admin.dto";
import { KoraAdminService } from "./kora-admin.service";

@Controller("kora/admin")
@UseGuards(AdminGuard)
export class KoraAdminController {
  constructor(private readonly adminService: KoraAdminService) {}

  @Get("participants")
  @ApiOkResponse({ type: KoraAdminOverviewDto })
  async overview(): Promise<KoraAdminOverviewDto> {
    return new KoraAdminOverviewDto(await this.adminService.overview());
  }

  @Delete("participants/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async deleteParticipant(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    const deleted = await this.adminService.deleteParticipant(id);
    if (!deleted.ok) {
      throw new NotFoundException("Participant not found");
    }
  }

  @Delete("abandoned-signups/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async deleteAbandonedSignup(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    const deleted = await this.adminService.deleteAbandonedSignup(id);
    if (!deleted.ok) {
      throw new NotFoundException("Abandoned signup not found");
    }
  }
}
