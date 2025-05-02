import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CommuniquesService } from './communiques.service';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import {
  CommuniqueDto,
  CreateCommuniqueDto,
  ReadResultDto,
  UpdateCommuniqueDto,
} from './dto/communique.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AuthGuard, JwtRequest } from '../auth/guards/auth.guard';

@Controller('communiques')
export class CommuniquesController {
  constructor(private readonly communiquesService: CommuniquesService) {}

  @Post()
  @UseGuards(AdminGuard)
  @ApiCreatedResponse({ type: CreateCommuniqueDto })
  create(@Body() createCommuniqueDto: CreateCommuniqueDto) {
    return this.communiquesService.create(createCommuniqueDto);
  }

  @Get()
  @ApiOkResponse({ type: [CommuniqueDto] })
  findAll() {
    return this.communiquesService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: CommuniqueDto })
  findOne(@Param('id') id: string) {
    return this.communiquesService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CommuniqueDto })
  update(
    @Param('id') id: string,
    @Body() updateCommuniqueDto: UpdateCommuniqueDto,
  ) {
    return this.communiquesService.update(+id, updateCommuniqueDto);
  }

  @Post(':id/read')
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  read(@Request() req: JwtRequest, @Param('id') id: string) {
    console.log('setting read: ', req.user.sub, id);
    return this.communiquesService.setRead(req.user.sub, +id);
  }

  @Get(':id/read')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ReadResultDto })
  async getRead(
    @Request() req: JwtRequest,
    @Param('id') id: string,
  ): Promise<ReadResultDto> {
    const read = await this.communiquesService.getRead(req.user.sub, +id);
    return { read };
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: Boolean })
  remove(@Param('id') id: string) {
    return this.communiquesService.remove(+id);
  }
}
