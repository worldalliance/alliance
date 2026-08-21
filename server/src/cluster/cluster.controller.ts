import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import { ClusterService } from "./cluster.service";
import {
  ClusterAdminDto,
  ReassignAllClustersResultDto,
  UpdateClusterDto,
} from "./dto/cluster.dto";

@Controller("cluster")
export class ClusterController {
  constructor(private readonly clusterService: ClusterService) {}

  @Get("admin")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [ClusterAdminDto] })
  async listAdmin(): Promise<ClusterAdminDto[]> {
    return (await this.clusterService.findAllWithMembers()).map(
      (c) => new ClusterAdminDto(c),
    );
  }

  @Post("admin/reassign-all")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ReassignAllClustersResultDto })
  async reassignAllAdmin(): Promise<ReassignAllClustersResultDto> {
    return new ReassignAllClustersResultDto(
      await this.clusterService.reassignAllUsers(),
    );
  }

  @Patch("admin/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ClusterAdminDto })
  async updateAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateClusterDto,
  ): Promise<ClusterAdminDto> {
    return new ClusterAdminDto(
      await this.clusterService.updateDisplayName(id, dto.displayName),
    );
  }
}
