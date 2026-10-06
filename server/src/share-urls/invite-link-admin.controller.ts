import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import {
  InviteLinkPageDto,
  InviteLinkQueryDto,
} from "./dto/invite-link-admin.dto";
import { InviteLinkAdminService } from "./invite-link-admin.service";

@Controller("share-urls/admin/invite-links")
@UseGuards(AdminGuard)
export class InviteLinkAdminController {
  constructor(private readonly service: InviteLinkAdminService) {}

  @Get()
  @ApiOkResponse({ type: InviteLinkPageDto })
  async search(@Query() query: InviteLinkQueryDto): Promise<InviteLinkPageDto> {
    return new InviteLinkPageDto(await this.service.search(query));
  }
}
