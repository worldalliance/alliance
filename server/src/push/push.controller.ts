import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiProperty } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { IsDefined, IsNumber } from 'class-validator';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { Repository } from 'typeorm';
import { Push } from './push.entity';
import type { JwtRequest } from 'src/auth/guards/jwtreq';

class PushOpenedDto {
  @ApiProperty()
  @IsDefined()
  @IsNumber()
  cid: number;
}

@Controller('push')
export class PushController {
  constructor(
    @InjectRepository(Push)
    private readonly pushRepository: Repository<Push>,
  ) {}

  @Post('opened')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: Push })
  async markOpened(
    @Body() body: PushOpenedDto,
    @Request() req: JwtRequest,
  ): Promise<Push> {
    const push = await this.pushRepository.findOneByOrFail({
      id: body.cid,
      user: { id: req.user.sub },
    });
    push.openedAt = new Date();
    return this.pushRepository.save(push);
  }
}
