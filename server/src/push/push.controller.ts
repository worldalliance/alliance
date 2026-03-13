import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiProperty } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { IsDefined, IsNumber } from 'class-validator';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { Repository } from 'typeorm';
import { Push } from './push.entity';

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
  async markOpened(@Body() body: PushOpenedDto): Promise<Push> {
    const push = await this.pushRepository.findOneByOrFail({ id: body.cid });
    push.openedAt = new Date();
    return this.pushRepository.save(push);
  }
}
