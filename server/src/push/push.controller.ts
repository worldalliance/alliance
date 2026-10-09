import {
  Body,
  Controller,
  NotFoundException,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { AuthGuard } from "src/auth/guards/auth.guard";
import type { JwtRequest } from "src/auth/tokens";
import { IsNull, Repository } from "typeorm";
import { PushOpenedDto } from "./dto/push-opened.dto";
import { Push } from "./push.entity";

@Controller("push")
export class PushController {
  constructor(
    @InjectRepository(Push)
    private readonly pushRepository: Repository<Push>,
  ) {}

  @Post("opened")
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async markOpened(
    @Body() body: PushOpenedDto,
    @Request() req: JwtRequest,
  ): Promise<void> {
    const { affected } = await this.pushRepository.update(
      { id: body.cid, user: { id: req.user.sub }, deletedAt: IsNull() },
      { openedAt: new Date() },
    );
    if (!affected) {
      throw new NotFoundException("Push not found.");
    }
  }
}
