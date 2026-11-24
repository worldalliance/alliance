import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import type { JwtPayload } from "src/auth/tokens";
import { ReqUser } from "src/auth/user.decorator";
import {
  SaveSplitDto,
  SaveSplitResultDto,
  SplitGroupsDto,
  SplitPreviewResultDto,
  SuiteSplitDto,
} from "./dto/suite-split.dto";
import { SuiteSplitsService } from "./suite-splits.service";

@Controller("actions/suite/:suiteId/split")
@UseGuards(AdminGuard)
export class SuiteSplitsController {
  constructor(private readonly splits: SuiteSplitsService) {}

  @Get()
  @ApiOkResponse({ type: SuiteSplitDto })
  @ApiResponse({ status: 404, description: "The suite doesn't use groups." })
  async splitAdmin(
    @Param("suiteId", ParseIntPipe) suiteId: number,
  ): Promise<SuiteSplitDto> {
    return new SuiteSplitDto(await this.splits.get(suiteId));
  }

  @Post()
  @ApiOkResponse({ type: SuiteSplitDto })
  @ApiResponse({
    status: 400,
    description: "An action still has its own participants or prerequisites.",
  })
  @ApiResponse({
    status: 409,
    description: "The suite already uses groups or is scheduled.",
  })
  async convertToSplitAdmin(
    @Param("suiteId", ParseIntPipe) suiteId: number,
    @ReqUser() user: JwtPayload,
  ): Promise<SuiteSplitDto> {
    await this.splits.convert({ suiteId, userId: user.sub });
    return new SuiteSplitDto(await this.splits.get(suiteId));
  }

  @Post("save")
  @HttpCode(200)
  @ApiOkResponse({ type: SaveSplitResultDto })
  @ApiResponse({
    status: 409,
    description:
      "The groups or the suite's actions changed since the admin opened them.",
  })
  async saveSplitAdmin(
    @Param("suiteId", ParseIntPipe) suiteId: number,
    @Body() body: SaveSplitDto,
    @ReqUser() user: JwtPayload,
  ): Promise<SaveSplitResultDto> {
    return new SaveSplitResultDto(
      await this.splits.save({
        suiteId,
        baseVersionId: body.baseVersionId,
        drafts: body.groups,
        savedById: user.sub,
      }),
    );
  }

  @Post("preview")
  @HttpCode(200)
  @ApiOkResponse({ type: SplitPreviewResultDto })
  async previewSplitAdmin(
    @Param("suiteId", ParseIntPipe) suiteId: number,
    @Body() body: SplitGroupsDto,
  ): Promise<SplitPreviewResultDto> {
    return new SplitPreviewResultDto(
      await this.splits.preview({ suiteId, drafts: body.groups }),
    );
  }
}
