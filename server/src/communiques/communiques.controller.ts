import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { CommuniquesService } from './communiques.service';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import {
  CommuniqueDto,
  CreateCommuniqueDto,
  UpdateCommuniqueDto,
} from './dto/communique.dto';

@Controller('communiques')
export class CommuniquesController {
  constructor(private readonly communiquesService: CommuniquesService) {}

  @Post()
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
  @ApiOkResponse({ type: CommuniqueDto })
  update(
    @Param('id') id: string,
    @Body() updateCommuniqueDto: UpdateCommuniqueDto,
  ) {
    return this.communiquesService.update(+id, updateCommuniqueDto);
  }

  @Delete(':id')
  @ApiOkResponse({ type: Boolean })
  remove(@Param('id') id: string) {
    return this.communiquesService.remove(+id);
  }
}
