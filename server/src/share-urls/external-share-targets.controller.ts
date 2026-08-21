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
import { AdminGuard } from "src/auth/guards/admin.guard";
import {
  CreateExternalShareTargetDto,
  ExternalShareTargetDto,
  UpdateExternalShareTargetDto,
} from "./dto/external-share-target.dto";
import { ExternalShareTargetsService } from "./external-share-targets.service";

@Controller("external-share-targets")
export class ExternalShareTargetsController {
  constructor(
    private readonly externalShareTargetsService: ExternalShareTargetsService,
  ) {}

  @Get()
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ExternalShareTargetDto, isArray: true })
  async findAllAdmin(): Promise<ExternalShareTargetDto[]> {
    const targets = await this.externalShareTargetsService.findAll();
    return targets.map((t) => new ExternalShareTargetDto(t));
  }

  @Get(":id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ExternalShareTargetDto })
  async findOneAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ExternalShareTargetDto> {
    return new ExternalShareTargetDto(
      await this.externalShareTargetsService.findOne(id),
    );
  }

  @Post()
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ExternalShareTargetDto })
  async createAdmin(
    @Body() dto: CreateExternalShareTargetDto,
  ): Promise<ExternalShareTargetDto> {
    return new ExternalShareTargetDto(
      await this.externalShareTargetsService.create(dto),
    );
  }

  @Patch(":id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ExternalShareTargetDto })
  async updateAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateExternalShareTargetDto,
  ): Promise<ExternalShareTargetDto> {
    return new ExternalShareTargetDto(
      await this.externalShareTargetsService.update(id, dto),
    );
  }

  @Delete(":id")
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async removeAdmin(@Param("id", ParseIntPipe) id: number): Promise<void> {
    await this.externalShareTargetsService.remove(id);
  }
}
