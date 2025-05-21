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
  ValidationPipe,
  UsePipes,
  ParseIntPipe,
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
import { Public } from '../auth/public.decorator';

@Controller('actions')
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

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

  @Get('findAll')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ActionDto] })
  async findAll(@Request() req: JwtRequest) {
    return this.actionsService.findPublicWithRelation(req.user?.sub);
  }

  @Get()
  @Public()
  @ApiOkResponse({ type: [ActionDto] })
  async findAllPublic() {
    return this.actionsService.findPublic();
  }

  @Get('all')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [ActionDto] })
  async findAllWithDrafts() {
    return this.actionsService.findAll();
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionDto })
  @ApiUnauthorizedResponse()
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: JwtRequest,
  ): Promise<ActionDto | null> {
    return this.actionsService.findOneWithRelation(id, req.user?.sub);
  }

  @Post('create')
  @UseGuards(AdminGuard)
  @UsePipes(new ValidationPipe())
  @ApiOkResponse({ type: ActionDto })
  create(@Body() createActionDto: CreateActionDto) {
    return this.actionsService.create(createActionDto);
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
