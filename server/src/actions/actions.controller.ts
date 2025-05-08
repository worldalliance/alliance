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
import {
  ActionDto,
  CreateActionDto,
  UpdateActionDto,
  UserActionDto,
} from './dto/action.dto';
import { AuthGuard, JwtRequest } from '../auth/guards/auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ApiOkResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';

@Controller('actions')
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Post('create')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionDto })
  create(@Body() createActionDto: CreateActionDto) {
    return this.actionsService.create(createActionDto);
  }

  @Post('join/:id')
  @UseGuards(AuthGuard)
  join(@Request() req: JwtRequest, @Param('id') id: string) {
    if (!req.user) {
      throw new UnauthorizedException('User not found');
    }
    return this.actionsService.joinAction(+id, req.user.sub);
  }

  @Get('myStatus/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserActionDto })
  async myStatus(
    @Request() req: JwtRequest,
    @Param('id') id: string,
  ): Promise<UserActionDto | null> {
    if (!req.user) {
      throw new UnauthorizedException('User not found');
    }
    const userAction = await this.actionsService.getActionRelation(
      +id,
      req.user.sub,
    );
    console.log(userAction);
    return userAction;
  }

  @Get()
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ActionDto] })
  async findAll() {
    return this.actionsService.findAll();
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionDto })
  @ApiUnauthorizedResponse()
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
