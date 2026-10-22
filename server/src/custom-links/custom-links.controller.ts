import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import { AuthOptionalGuard } from "src/auth/guards/authoptional.guard";
import { Public } from "src/auth/public.decorator";
import { CustomLinksService } from "./custom-links.service";
import {
  CreateCustomLinkDto,
  CustomLinkDestinationDto,
  CustomLinkDto,
  UpdateCustomLinkDto,
} from "./dto/custom-link.dto";

@Controller("custom-links")
export class CustomLinksController {
  constructor(private readonly customLinksService: CustomLinksService) {}

  @Get()
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CustomLinkDto, isArray: true })
  async findAllAdmin(): Promise<CustomLinkDto[]> {
    return (await this.customLinksService.findAll()).map(
      (link) => new CustomLinkDto(link),
    );
  }

  @Post()
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CustomLinkDto })
  async createAdmin(@Body() dto: CreateCustomLinkDto): Promise<CustomLinkDto> {
    return new CustomLinkDto(await this.customLinksService.create(dto));
  }

  @Patch(":id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CustomLinkDto })
  async updateAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCustomLinkDto,
  ): Promise<CustomLinkDto> {
    return new CustomLinkDto(await this.customLinksService.update(id, dto));
  }

  @Delete(":id")
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async removeAdmin(@Param("id", ParseIntPipe) id: number): Promise<void> {
    await this.customLinksService.remove(id);
  }

  @Post("resolve/:slug")
  @Public()
  @UseGuards(AuthOptionalGuard)
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiOkResponse({ type: CustomLinkDestinationDto })
  async resolve(
    @Param("slug") slug: string,
  ): Promise<CustomLinkDestinationDto> {
    return new CustomLinkDestinationDto(
      await this.customLinksService.resolve(slug),
    );
  }
}
