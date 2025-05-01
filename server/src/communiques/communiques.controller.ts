import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { CommuniquesService } from './communiques.service';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import {
  CommuniqueDto,
  CreateCommuniqueDto,
  UpdateCommuniqueDto,
} from './dto/communique.dto';
import { AdminGuard } from 'src/auth/guards/admin.guard';

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

  @Delete(':id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: Boolean })
  remove(@Param('id') id: string) {
    return this.communiquesService.remove(+id);
  }
}
