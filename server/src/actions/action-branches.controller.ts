import {
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
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { JwtRequest } from "src/auth/tokens";
import { AdminGuard } from "../auth/guards/admin.guard";
import { ActionBranchAdminService } from "./action-branch-admin.service";
import {
  ActionFormRoutingService,
  MoveTargetKind,
} from "./action-form-routing.service";
import { parseCohortExpressionOrThrow } from "./cohort-reference-validation";
import {
  ActionBranchDto,
  ActionBranchesListDto,
  ActionFormAssignmentDto,
  BranchRoutingPreviewDto,
  CreateActionBranchDto,
  MoveToBranchDto,
  MoveToVariantDto,
  PreviewBranchRoutingDto,
  ReorderActionBranchesDto,
  RerouteActionBranchesDto,
  RerouteMovesDto,
  UpdateActionBranchDto,
} from "./dto/action-branch.dto";

@Controller("actions")
@UseGuards(AdminGuard)
export class ActionBranchesController {
  constructor(
    private readonly branchAdmin: ActionBranchAdminService,
    private readonly routing: ActionFormRoutingService,
  ) {}

  @Get(":id/branches")
  @ApiOkResponse({ type: ActionBranchesListDto })
  async listBranchesAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ActionBranchesListDto> {
    const [branches, stats] = await Promise.all([
      this.branchAdmin.listForAction(id),
      this.branchAdmin.getStatsForAction(id),
    ]);
    return new ActionBranchesListDto({ branches, stats });
  }

  @Post(":id/branches")
  @ApiOkResponse({ type: ActionBranchDto })
  async createBranchAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: CreateActionBranchDto,
  ): Promise<ActionBranchDto> {
    return new ActionBranchDto(await this.branchAdmin.create(id, body));
  }

  @Patch("branches/:branchId")
  @ApiOkResponse({ type: ActionBranchDto })
  async updateBranchAdmin(
    @Param("branchId", ParseIntPipe) branchId: number,
    @Body() body: UpdateActionBranchDto,
  ): Promise<ActionBranchDto> {
    return new ActionBranchDto(await this.branchAdmin.update(branchId, body));
  }

  @Delete("branches/:branchId")
  @ApiOkResponse()
  async deleteBranchAdmin(
    @Param("branchId", ParseIntPipe) branchId: number,
  ): Promise<void> {
    await this.branchAdmin.delete(branchId);
  }

  @Put(":id/branches/order")
  @ApiOkResponse()
  async reorderBranchesAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: ReorderActionBranchesDto,
  ): Promise<void> {
    await this.branchAdmin.reorder({ actionId: id, branchIds: body.branchIds });
  }

  @Post(":id/branches/routing-preview")
  @ApiOkResponse({ type: BranchRoutingPreviewDto })
  async previewBranchRoutingAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: PreviewBranchRoutingDto,
  ): Promise<BranchRoutingPreviewDto> {
    return new BranchRoutingPreviewDto(
      await this.routing.previewRouting({
        actionId: id,
        rules: body.rules.map(parseCohortExpressionOrThrow),
      }),
    );
  }

  @Get(":id/branches/reroute")
  @ApiOkResponse({ type: RerouteMovesDto })
  async previewRerouteAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<RerouteMovesDto> {
    return new RerouteMovesDto(await this.routing.previewReroute(id));
  }

  @Post(":id/branches/reroute")
  @ApiOkResponse({ type: RerouteMovesDto })
  async rerouteAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: RerouteActionBranchesDto,
  ): Promise<RerouteMovesDto> {
    return new RerouteMovesDto(
      await this.routing.reroute({ actionId: id, notify: body.notify }),
    );
  }

  @Post(":id/branches/move")
  @ApiOkResponse()
  async moveToBranchAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: MoveToBranchDto,
    @Request() req: JwtRequest,
  ): Promise<void> {
    await this.routing.moveMember({
      actionId: id,
      userId: body.userId,
      to: { kind: MoveTargetKind.Branch, id: body.branchId },
      notify: body.notify,
      staffUserId: req.user.sub,
      now: new Date(),
    });
  }

  @Post(":id/form-variants/move")
  @ApiOkResponse()
  async moveToVariantAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: MoveToVariantDto,
    @Request() req: JwtRequest,
  ): Promise<void> {
    await this.routing.moveMember({
      actionId: id,
      userId: body.userId,
      to: { kind: MoveTargetKind.Variant, id: body.variantId },
      notify: body.notify,
      staffUserId: req.user.sub,
      now: new Date(),
    });
  }

  @Get(":id/form-assignments")
  @ApiOkResponse({ type: ActionFormAssignmentDto, isArray: true })
  async listFormAssignmentsAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ActionFormAssignmentDto[]> {
    const assignments = await this.routing.findAssignments(id);
    return assignments.map((a) => new ActionFormAssignmentDto(a));
  }
}
