import { Body, Controller, Post, Request, UseGuards } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { AuthGuard } from "src/auth/guards/auth.guard";
import type { JwtRequest } from "src/auth/guards/jwtreq";
import { Repository } from "typeorm";
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
    const push = await this.pushRepository.findOneByOrFail({
      id: body.cid,
      user: { id: req.user.sub },
    });
    push.openedAt = new Date();
    await this.pushRepository.save(push);
  }
}
