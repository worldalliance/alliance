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
  ActionEventDto,
  CreateActionDto,
  UpdateActionDto,
  UserActionDto,
} from './dto/action.dto';
import { AuthGuard, JwtRequest } from '../auth/guards/auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ApiOkResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { Sse, MessageEvent } from '@nestjs/common';
import { Observable, fromEvent, concat, from } from 'rxjs';
import { map, filter, scan } from 'rxjs/operators';

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

  @Post('complete/:id')
  @UseGuards(AuthGuard)
  complete(@Request() req: JwtRequest, @Param('id') id: string) {
    if (!req.user) {
      throw new UnauthorizedException('User not found');
    }
    return this.actionsService.completeAction(+id, req.user.sub);
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

  @Get('withStatus')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ActionDto] })
  async findAllWithStatus(@Request() req: JwtRequest) {
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

  @Post(':id/events')
  @UseGuards(AdminGuard)
  @UsePipes(new ValidationPipe())
  @ApiOkResponse({ type: ActionDto })
  async addEvent(
    @Param('id', ParseIntPipe) id: number,
    @Body() actionEventDto: ActionEventDto,
  ): Promise<ActionDto> {
    return this.actionsService.addEvent(id, actionEventDto);
  }

  @Sse('live/:id')
  @Public()
  sseActionCount(
    @Param('id', ParseIntPipe) id: number,
  ): Observable<MessageEvent> {
    const snapshot$ = from(this.actionsService.countCommitted(id));

    const deltas$ = fromEvent<{ actionId: number; delta: number }>(
      this.actionsService.eventEmitter,
      'action.delta',
    ).pipe(
      filter((e) => e.actionId === id),
      map((e) => e.delta),
    );

    const counter$ = concat(snapshot$, deltas$).pipe(
      scan((runningTotal, delta) => runningTotal + delta),
      map((total) => ({ data: total.toString() }) as MessageEvent),
    );

    // const heartbeat$ = interval(15000).pipe(
    //   map(() => ({ event: 'ping', data: 'h' }) as MessageEvent),
    // );

    return counter$;
  }
}
