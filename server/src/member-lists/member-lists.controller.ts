import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import type { JwtPayload } from "src/auth/tokens";
import { ReqUser } from "src/auth/user.decorator";
import {
  MemberListDto,
  SaveMemberListDto,
  UpdateMemberListDto,
} from "./dto/member-list.dto";
import { MemberListsService } from "./member-lists.service";

@Controller("member-lists")
@UseGuards(AdminGuard)
export class MemberListsController {
  constructor(private readonly memberListsService: MemberListsService) {}

  @Get()
  @ApiOkResponse({ type: MemberListDto, isArray: true })
  async listAdmin(): Promise<MemberListDto[]> {
    return (await this.memberListsService.list()).map(
      (list) => new MemberListDto(list),
    );
  }

  @Post()
  @ApiOkResponse({ type: MemberListDto })
  async createAdmin(
    @Body() body: SaveMemberListDto,
    @ReqUser() user: JwtPayload,
  ): Promise<MemberListDto> {
    return new MemberListDto(
      await this.memberListsService.create({
        name: body.name,
        userIds: body.userIds,
        savedById: user.sub,
      }),
    );
  }

  @Put(":id")
  @ApiOkResponse({ type: MemberListDto })
  @ApiResponse({ status: 404, description: "No list has this id." })
  @ApiResponse({
    status: 409,
    description: "The list changed since the admin opened it.",
  })
  async updateAdmin(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateMemberListDto,
    @ReqUser() user: JwtPayload,
  ): Promise<MemberListDto> {
    return new MemberListDto(
      await this.memberListsService.update({
        id,
        baseVersionId: body.baseVersionId,
        baseName: body.baseName,
        name: body.name,
        userIds: body.userIds,
        savedById: user.sub,
      }),
    );
  }
}
