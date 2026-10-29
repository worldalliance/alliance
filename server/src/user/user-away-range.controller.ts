import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import type { JwtRequest } from "src/auth/tokens";
import { AuthGuard } from "../auth/guards/auth.guard";
import { AwayRangeEditor } from "./away-range-history";
import {
  AwayRangesInWindowQueryDto,
  CreateAwayRangeDto,
  MemberAwayRangeDto,
  UpdateAwayRangeDto,
  UserAwayRangeDto,
} from "./dto/away-range.dto";
import { UserAwayRangeService } from "./user-away-range.service";

@Controller("user")
export class UserAwayRangeController {
  constructor(private readonly userAwayRangeService: UserAwayRangeService) {}

  @Post("awayranges")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserAwayRangeDto })
  @ApiUnauthorizedResponse()
  async createAwayRange(
    @Request() req: JwtRequest,
    @Body() body: CreateAwayRangeDto,
  ): Promise<UserAwayRangeDto> {
    return new UserAwayRangeDto(
      await this.userAwayRangeService.createAwayRange({
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
    return (await this.userAwayRangeService.getAwayRanges(req.user.sub)).map(
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
    await this.userAwayRangeService.deleteAwayRange({
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
      await this.userAwayRangeService.updateAwayRange({
        userId: req.user.sub,
        awayRangeId: id,
        data: body,
        editor: AwayRangeEditor.Member,
      }),
    );
  }

  @Get("admin/awayranges")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [MemberAwayRangeDto] })
  @ApiUnauthorizedResponse()
  async getAwayRangesInWindowAdmin(
    @Query() query: AwayRangesInWindowQueryDto,
  ): Promise<MemberAwayRangeDto[]> {
    const ranges = await this.userAwayRangeService.getAwayRangesInWindow({
      from: new Date(query.from),
      to: new Date(query.to),
    });
    return ranges.map((range) => new MemberAwayRangeDto(range));
  }

  @Get("awayranges/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [UserAwayRangeDto] })
  @ApiUnauthorizedResponse()
  async getAwayRangeForUserAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<UserAwayRangeDto[]> {
    return (await this.userAwayRangeService.getAwayRanges(id)).map(
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
      await this.userAwayRangeService.createAwayRange({
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
      await this.userAwayRangeService.updateAwayRange({
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
    await this.userAwayRangeService.deleteAwayRange({
      userId,
      awayRangeId: id,
      editor: AwayRangeEditor.Admin,
    });
  }
}
