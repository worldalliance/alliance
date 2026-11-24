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
  PartitionPartsDto,
  PartitionPreviewResultDto,
  SavePartitionDto,
  SavePartitionResultDto,
  SuitePartitionDto,
} from "./dto/suite-partition.dto";
import { SuitePartitionsService } from "./suite-partitions.service";

@Controller("actions/suite/:suiteId/partition")
@UseGuards(AdminGuard)
export class SuitePartitionsController {
  constructor(private readonly partitions: SuitePartitionsService) {}

  @Get()
  @ApiOkResponse({ type: SuitePartitionDto })
  @ApiResponse({ status: 404, description: "The suite doesn't use parts." })
  async partitionAdmin(
    @Param("suiteId", ParseIntPipe) suiteId: number,
  ): Promise<SuitePartitionDto> {
    return new SuitePartitionDto(await this.partitions.get(suiteId));
  }

  @Post()
  @ApiOkResponse({ type: SuitePartitionDto })
  @ApiResponse({
    status: 400,
    description: "An action still has its own participants or prerequisites.",
  })
  @ApiResponse({
    status: 409,
    description: "The suite already uses parts or is scheduled.",
  })
  async convertToPartitionAdmin(
    @Param("suiteId", ParseIntPipe) suiteId: number,
    @ReqUser() user: JwtPayload,
  ): Promise<SuitePartitionDto> {
    await this.partitions.convert({ suiteId, userId: user.sub });
    return new SuitePartitionDto(await this.partitions.get(suiteId));
  }

  @Post("save")
  @HttpCode(200)
  @ApiOkResponse({ type: SavePartitionResultDto })
  @ApiResponse({
    status: 409,
    description:
      "The partition or the suite's actions changed since the admin opened them.",
  })
  async savePartitionAdmin(
    @Param("suiteId", ParseIntPipe) suiteId: number,
    @Body() body: SavePartitionDto,
    @ReqUser() user: JwtPayload,
  ): Promise<SavePartitionResultDto> {
    return new SavePartitionResultDto(
      await this.partitions.save({
        suiteId,
        baseVersionId: body.baseVersionId,
        drafts: body.parts,
        savedById: user.sub,
      }),
    );
  }

  @Post("preview")
  @HttpCode(200)
  @ApiOkResponse({ type: PartitionPreviewResultDto })
  async previewPartitionAdmin(
    @Param("suiteId", ParseIntPipe) suiteId: number,
    @Body() body: PartitionPartsDto,
  ): Promise<PartitionPreviewResultDto> {
    return new PartitionPreviewResultDto(
      await this.partitions.preview({ suiteId, drafts: body.parts }),
    );
  }
}
