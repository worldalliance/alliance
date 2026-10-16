import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import type { JwtRequest } from "src/auth/tokens";
import { AuthGuard } from "../auth/guards/auth.guard";
import { AwayRangeEditor } from "./away-range-history";
import {
  CreateAwayRangeDto,
  UpdateAwayRangeDto,
  UserAwayRangeDto,
} from "./dto/away-range.dto";
import { UserService } from "./user.service";

@Controller("user")
export class UserAwayRangeController {
  constructor(private readonly userService: UserService) {}

  @Post("awayranges")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserAwayRangeDto })
  @ApiUnauthorizedResponse()
  async createAwayRange(
    @Request() req: JwtRequest,
    @Body() body: CreateAwayRangeDto,
  ): Promise<UserAwayRangeDto> {
    return new UserAwayRangeDto(
      await this.userService.createAwayRange({
        userId: req.user.sub,
        data: body,
        editor: AwayRangeEditor.Member,
      }),
    );
  }

  @Get("awayranges")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [UserAwayRangeDto] })
  @ApiUnauthorizedResponse()
  async getAwayRanges(@Request() req: JwtRequest): Promise<UserAwayRangeDto[]> {
    return (await this.userService.getAwayRanges(req.user.sub)).map(
      (range) => new UserAwayRangeDto(range),
    );
  }

  @Delete("awayranges/:id")
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  async deleteAwayRange(
    @Request() req: JwtRequest,
    @Param("id", ParseIntPipe) id: number,
  ): Promise<void> {
    await this.userService.deleteAwayRange({
      userId: req.user.sub,
      awayRangeId: id,
      editor: AwayRangeEditor.Member,
    });
  }

  @Patch("awayranges/:id")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserAwayRangeDto })
  @ApiUnauthorizedResponse()
  async updateAwayRange(
    @Request() req: JwtRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdateAwayRangeDto,
  ): Promise<UserAwayRangeDto> {
    return new UserAwayRangeDto(
      await this.userService.updateAwayRange({
        userId: req.user.sub,
        awayRangeId: id,
        data: body,
        editor: AwayRangeEditor.Member,
      }),
    );
  }

  @Get("awayranges/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [UserAwayRangeDto] })
  @ApiUnauthorizedResponse()
  async getAwayRangeForUserAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<UserAwayRangeDto[]> {
    return (await this.userService.getAwayRanges(id)).map(
      (range) => new UserAwayRangeDto(range),
    );
  }

  @Post("admin/:userId/awayranges")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserAwayRangeDto })
  @ApiUnauthorizedResponse()
  async createAwayRangeAdmin(
    @Param("userId", ParseIntPipe) userId: number,
    @Body() body: CreateAwayRangeDto,
  ): Promise<UserAwayRangeDto> {
    return new UserAwayRangeDto(
      await this.userService.createAwayRange({
        userId,
        data: body,
        editor: AwayRangeEditor.Admin,
      }),
    );
  }

  @Patch("admin/:userId/awayranges/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserAwayRangeDto })
  @ApiUnauthorizedResponse()
  async updateAwayRangeAdmin(
    @Param("userId", ParseIntPipe) userId: number,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdateAwayRangeDto,
  ): Promise<UserAwayRangeDto> {
    return new UserAwayRangeDto(
      await this.userService.updateAwayRange({
        userId,
        awayRangeId: id,
        data: body,
        editor: AwayRangeEditor.Admin,
      }),
    );
  }

  @Delete("admin/:userId/awayranges/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  async deleteAwayRangeAdmin(
    @Param("userId", ParseIntPipe) userId: number,
    @Param("id", ParseIntPipe) id: number,
  ): Promise<void> {
    await this.userService.deleteAwayRange({
      userId,
      awayRangeId: id,
      editor: AwayRangeEditor.Admin,
    });
  }
}
