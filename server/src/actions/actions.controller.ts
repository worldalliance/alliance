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
import { ActionDto } from './dto/create-action.dto';
import { UpdateActionDto } from './dto/update-action.dto';
import { AuthGuard, JwtRequest } from '../auth/guards/auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ApiOkResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AllActionsDto } from './dto/actionresponse.dto';

@Controller('actions')
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Post('create')
  @UseGuards(AdminGuard)
  create(@Body() createActionDto: ActionDto) {
    return this.actionsService.create(createActionDto);
  }

  @Post(':id')
  @UseGuards(AuthGuard)
  join(@Request() req: JwtRequest, @Param('id') id: string) {
    if (!req.user) {
      throw new UnauthorizedException('User not found');
    }
    return this.actionsService.joinAction(+id, req.user.sub);
  }

  @Get()
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [AllActionsDto] })
  findAll() {
    return this.actionsService.findAll();
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionDto })
  @ApiUnauthorizedResponse()
  findOne(@Param('id') id: string) {
    console.log('getting an action: ', id);
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
