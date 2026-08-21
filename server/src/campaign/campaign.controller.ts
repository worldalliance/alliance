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
import { CampaignService } from "./campaign.service";
import {
  CampaignDto,
  CreateCampaignDto,
  UpdateCampaignDto,
} from "./dto/campaign.dto";

@Controller("campaigns")
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Get()
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CampaignDto, isArray: true })
  async findAllAdmin(): Promise<CampaignDto[]> {
    const campaigns = await this.campaignService.findAll();
    return campaigns.map((c) => new CampaignDto(c));
  }

  @Get(":id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CampaignDto })
  async findOneAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<CampaignDto> {
    return new CampaignDto(await this.campaignService.findOne(id));
  }

  @Post()
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CampaignDto })
  async createAdmin(@Body() dto: CreateCampaignDto): Promise<CampaignDto> {
    return new CampaignDto(await this.campaignService.create(dto));
  }

  @Patch(":id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CampaignDto })
  async updateAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCampaignDto,
  ): Promise<CampaignDto> {
    return new CampaignDto(await this.campaignService.update(id, dto));
  }
}
