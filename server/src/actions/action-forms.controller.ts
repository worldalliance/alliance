import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AdminGuard } from "../auth/guards/admin.guard";
import { ActionFormVariantService } from "./action-form-variant.service";
import { ActionsService } from "./actions.service";
import {
  ActionFormVariantDto,
  ActionFormVariantsListDto,
  CreateActionFormVariantDto,
  UpdateActionFormVariantDto,
} from "./dto/action-form-variant.dto";
import {
  AdminFollowUpFormDto,
  CreateFollowUpFormDto,
  UpdateFollowUpFormDto,
} from "./dto/follow-up-form.dto";
import { loadedActionFollowUpForms } from "./entities/action.entity";

@Controller("actions")
export class ActionFormsController {
  constructor(
    private readonly actionsService: ActionsService,
    private readonly actionFormVariantService: ActionFormVariantService,
  ) {}

  @Post(":id/follow-up-forms")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: AdminFollowUpFormDto })
  async createFollowUpFormAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateFollowUpFormDto,
  ): Promise<AdminFollowUpFormDto> {
    const created = await this.actionsService.createFollowUpForm(id, dto);
    const withForm = await this.actionsService.findOneOrFail({
      id,
      serverSide: true,
    });
    const found = loadedActionFollowUpForms(withForm).find(
      (f) => f.id === created.id,
    );
    return new AdminFollowUpFormDto(found ?? created);
  }

  @Patch("follow-up-forms/:followUpFormId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: AdminFollowUpFormDto })
  async updateFollowUpFormAdmin(
    @Param("followUpFormId", ParseIntPipe) followUpFormId: number,
    @Body() dto: UpdateFollowUpFormDto,
  ): Promise<AdminFollowUpFormDto> {
    const updated = await this.actionsService.updateFollowUpForm(
      followUpFormId,
      dto,
    );
    return new AdminFollowUpFormDto(updated);
  }

  @Delete("follow-up-forms/:followUpFormId")
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteFollowUpFormAdmin(
    @Param("followUpFormId", ParseIntPipe) followUpFormId: number,
  ): Promise<void> {
    return this.actionsService.deleteFollowUpForm(followUpFormId);
  }

  @Get(":id/form-variants")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionFormVariantsListDto })
  async listFormVariantsAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ActionFormVariantsListDto> {
    const [variants, stats] = await Promise.all([
      this.actionFormVariantService.listForAction(id),
      this.actionFormVariantService.getStatsForAction(id),
    ]);
    return new ActionFormVariantsListDto(variants, stats);
  }

  @Post(":id/form-variants")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionFormVariantDto })
  async createFormVariantAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: CreateActionFormVariantDto,
  ): Promise<ActionFormVariantDto> {
    const variant = await this.actionFormVariantService.createVariant(id, body);
    return new ActionFormVariantDto(variant);
  }

  @Patch("form-variants/:variantId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionFormVariantDto })
  async updateFormVariantAdmin(
    @Param("variantId", ParseIntPipe) variantId: number,
    @Body() body: UpdateActionFormVariantDto,
  ): Promise<ActionFormVariantDto> {
    const variant = await this.actionFormVariantService.updateVariant(
      variantId,
      body,
    );
    return new ActionFormVariantDto(variant);
  }

  @Delete("form-variants/:variantId")
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteFormVariantAdmin(
    @Param("variantId", ParseIntPipe) variantId: number,
  ): Promise<void> {
    await this.actionFormVariantService.deleteVariant(variantId);
  }
}
