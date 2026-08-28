import { AnalyticsEvent } from "@alliance/common/analytics";
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
import { ApiOkResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import { AuthGuard } from "src/auth/guards/auth.guard";
import type { JwtRequest } from "src/auth/guards/jwtreq";
import { Public } from "src/auth/public.decorator";
import { PosthogService } from "src/posthog/posthog.service";
import { ContractService } from "./contract.service";
import {
  ContractAdminDto,
  ContractDto,
  ContractEventDateDto,
  CreateContractDto,
  SignContractDto,
  UpdateContractDto,
} from "./dto/contract.dto";

@Controller("contract")
export class ContractController {
  constructor(
    private readonly contractService: ContractService,
    private readonly posthog: PosthogService,
  ) {}

  @Get("current")
  @Public()
  @ApiOkResponse({ type: ContractDto })
  async getCurrent(): Promise<ContractDto> {
    return new ContractDto(
      await this.contractService.findNewestActiveContract(),
    );
  }

  @Get("admin")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [ContractAdminDto] })
  async allAdmin(): Promise<ContractAdminDto[]> {
    return (await this.contractService.findAll()).map(
      (c) => new ContractAdminDto(c),
    );
  }

  @Get("admin/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ContractAdminDto })
  async findOneAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ContractAdminDto> {
    return new ContractAdminDto(await this.contractService.findOne(id));
  }

  @Get("detail/:id")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ContractDto })
  async getById(@Param("id", ParseIntPipe) id: number): Promise<ContractDto> {
    return new ContractDto(await this.contractService.findOne(id));
  }

  @Post("sign/:id")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ContractEventDateDto })
  async signContract(
    @Request() req: JwtRequest,
    @Body() body: SignContractDto,
    @Param("id", ParseIntPipe) contractId: number,
  ): Promise<ContractEventDateDto> {
    const date = await this.contractService.signContract({
      userId: req.user.sub,
      signedName: body.signedName,
      contractId,
    });
    this.posthog.capture({
      event: AnalyticsEvent.ContractSigned,
      distinctId: String(req.user.sub),
      properties: {
        contractId,
      },
    });
    return new ContractEventDateDto(date);
  }

  @Post("suspend")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ContractEventDateDto })
  async suspendContract(
    @Request() req: JwtRequest,
  ): Promise<ContractEventDateDto> {
    const date = await this.contractService.suspendContract({
      userId: req.user.sub,
    });
    this.posthog.capture({
      event: AnalyticsEvent.ContractSuspended,
      distinctId: String(req.user.sub),
    });
    return new ContractEventDateDto(date);
  }

  @Post("admin/suspend/:userId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ContractEventDateDto })
  async suspendContractAdmin(
    @Param("userId", ParseIntPipe) userId: number,
  ): Promise<ContractEventDateDto> {
    const date = await this.contractService.suspendContract({ userId });
    this.posthog.capture({
      event: AnalyticsEvent.ContractSuspended,
      distinctId: String(userId),
      properties: {
        adminInitiated: true,
      },
    });
    return new ContractEventDateDto(date);
  }

  @Post("create")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ContractAdminDto })
  async createAdmin(@Body() dto: CreateContractDto): Promise<ContractAdminDto> {
    return new ContractAdminDto(await this.contractService.create(dto));
  }

  @Patch("update/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ContractAdminDto })
  async updateAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateContractDto,
  ): Promise<ContractAdminDto> {
    return new ContractAdminDto(await this.contractService.update(id, dto));
  }
}
