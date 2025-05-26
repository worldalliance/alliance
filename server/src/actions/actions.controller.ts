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
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ActionsService } from './actions.service';
import {
  ActionDto,
  ActionWithRelationDto,
  CreateActionDto,
  UpdateActionDto,
  UserActionDto,
} from './dto/action.dto';
import { AuthGuard, JwtRequest } from '../auth/guards/auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ApiOkResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { Sse, MessageEvent } from '@nestjs/common';
import { Observable, fromEvent, from, merge } from 'rxjs';
import { map, filter, scan, share, bufferTime } from 'rxjs/operators';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Controller('actions')
export class ActionsController {
  private readonly delta$: Observable<{ actionId: number; delta: number }>;
  constructor(
    private readonly actionsService: ActionsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    /* ONE listener no matter how many clients */
    this.delta$ = fromEvent<{ actionId: number; delta: number }>(
      this.eventEmitter,
      'action.delta',
    ).pipe(share());
  }
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
  async findAllPublic(): Promise<ActionDto[]> {
    return this.actionsService.findPublic();
  }

  @Get('all')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [ActionDto] })
  async findAllWithDrafts() {
    return this.actionsService.findAll();
  }

  @Sse('live/:id')
  @Public()
  sseActionCount(
    @Param('id', ParseIntPipe) id: number,
  ): Observable<MessageEvent> {
    const snapshot$ = from(this.actionsService.countCommitted(id));

    const counter$ = merge(
      snapshot$,
      this.delta$.pipe(
        filter((e) => e.actionId === id),
        map((e) => e.delta),
      ),
    ).pipe(
      scan((total, delta) => total + delta),
      map((t) => ({ data: t.toString() }) as MessageEvent),
    );

    return counter$;
  }

  @Sse('live-list')
  @Public()
  liveList(@Query('ids') idsQuery?: string): Observable<MessageEvent> {
    if (!idsQuery) throw new BadRequestException('ids query param required');
    const ids = idsQuery.split(',').map(Number).filter(Boolean);
    const idSet = new Set(ids);

    /* 1️⃣ initial snapshot */
    const snapshot$ = from(this.actionsService.countCommittedBulk(ids));

    /* 2️⃣ batch all deltas for these ids every 100 ms */
    const batched$ = this.delta$.pipe(
      filter((e) => idSet.has(e.actionId)), // only the ids this client cares about
      bufferTime(100), // 100 ms window (tweak as needed)
      filter((buf) => buf.length > 0), // skip empty windows
      map((buf) => {
        // collapse many deltas into cumulative {id: Δ}
        const byId: Record<number, number> = {};
        for (const { actionId, delta } of buf) {
          byId[actionId] = (byId[actionId] ?? 0) + delta;
        }
        return byId;
      }),
    );

    /* 3️⃣ running totals */
    const counters$ = merge(snapshot$, batched$).pipe(
      scan(
        (state, change) => {
          // change is snapshot (full map) *or* batched delta map
          for (const id of Object.keys(change).map(Number)) {
            state[id] = (state[id] ?? 0) + change[id];
          }
          return { ...state }; // emit copy for distinct reference
        },
        {} as Record<number, number>,
      ),
      map((s) => ({ data: JSON.stringify(s) }) as MessageEvent),
    );

    return counters$;
  }

  @Get(':id')
  @Public()
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
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateActionDto: UpdateActionDto,
  ) {
    return this.actionsService.update(id, updateActionDto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.actionsService.remove(id);
  }

  @Get('completed/:id')
  @ApiOkResponse({ type: [ActionWithRelationDto] })
  async findCompletedForUser(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ActionWithRelationDto[]> {
    return this.actionsService.findCompletedForUser(+id);
  }
}
