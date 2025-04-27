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
  UnauthorizedException,
} from '@nestjs/common';
import { ActionsService } from './actions.service';
import { CreateActionDto } from './dto/create-action.dto';
import { UpdateActionDto } from './dto/update-action.dto';
import { AuthGuard, JwtRequest } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('actions')
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Post('create')
  @UseGuards(AdminGuard)
  create(@Body() createActionDto: CreateActionDto) {
    return this.actionsService.create(createActionDto);
  }

  @Post(':id')
  @UseGuards(AuthGuard)
  join(@Request() req: JwtRequest, @Param('id') id: string) {
    if (!req.user) {
      throw new UnauthorizedException('User not found');
    }
    return this.actionsService.joinAction(+id, req.user.email);
  }

  @Get()
  @UseGuards(AuthGuard)
  findAll() {
    console.log('findAll');
    return this.actionsService.findAll();
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  findOne(@Param('id') id: string) {
    return this.actionsService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id') id: string, @Body() updateActionDto: UpdateActionDto) {
    return this.actionsService.update(+id, updateActionDto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id') id: string) {
    return this.actionsService.remove(+id);
  }
}
