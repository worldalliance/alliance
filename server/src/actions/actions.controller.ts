import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  MessageEvent,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  Sse,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Observable, from, fromEvent, merge } from 'rxjs';
import { bufferTime, filter, map, scan, share } from 'rxjs/operators';
import { AuthOptionalGuard } from 'src/auth/guards/authoptional.guard';
import { CommentDto, CreateCommentDto } from 'src/forum/dto/comment.dto';
import { UserService } from 'src/user/user.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AuthGuard, JwtRequest } from '../auth/guards/auth.guard';
import { Public } from '../auth/public.decorator';
import { ActionsService, UserActionRelationDto } from './actions.service';
import {
  ActionActivityDto,
  ActionDto,
  ActionEventDto,
  ActionSuiteDto,
  CreateActionActivityDto,
  CreateActionDto,
  CreateActionEventDto,
  CreateActionSuiteDto,
  CreateActionUpdateDto,
  CreateTODReminderGroupDto,
  DeclineActionDto,
  LatLonDto,
  OptOutActionDto,
  PreEventNotifDataDto,
  PreEventNotifDataQueryDto,
  UpdateActionActivityDto,
  UpdateActionDto,
  UpdateActionEventDto,
} from './dto/action.dto';
import {
  NotificationScheduleEntryDto,
  NotificationScheduleQueryDto,
} from './dto/notification-schedule.dto';
import { ActionUpdate } from './entities/action-update.entity';
import { ActionEvent } from './entities/action-event.entity';
import { ReminderGroup } from './entities/reminder-group.entity';
import { NotificationPlan } from 'src/notifs/action-event-reminder.service';
import { ActionSuite } from './entities/action-suite.entity';
import { ActionEventNotifDto } from 'src/notifs/entities/action-event-notif.dto';

@Controller('actions')
export class ActionsController {
  private readonly delta$: Observable<{ actionId: number; delta: number }>;
  constructor(
    private readonly actionsService: ActionsService,
    private readonly eventEmitter: EventEmitter2,
    private userService: UserService,
  ) {
    this.delta$ = fromEvent<{ actionId: number; delta: number }>(
      this.eventEmitter,
      'action.delta',
    ).pipe(share());
  }

  @Post('join/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionActivityDto })
  join(@Request() req: JwtRequest, @Param('id', ParseIntPipe) id: number) {
    if (!req.user) {
      throw new UnauthorizedException('User not found');
    }
    return this.actionsService.joinAction(+id, req.user.sub);
  }

  @Post('decline/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionActivityDto })
  decline(
    @Request() req: JwtRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: DeclineActionDto,
  ) {
    return this.actionsService.declineAction(
      id,
      req.user.sub,
      body.reason,
      body.moral,
    );
  }

  @Post('optout/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionActivityDto })
  optout(
    @Request() req: JwtRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: OptOutActionDto,
  ) {
    return this.actionsService.optoutAction(
      id,
      req.user.sub,
      body.reason,
      body.outOfTime,
    );
  }

  @Post('complete/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionActivityDto })
  complete(@Request() req: JwtRequest, @Param('id', ParseIntPipe) id: number) {
    return this.actionsService.completeAction(id, req.user.sub);
  }

  @Get('myStatus/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserActionRelationDto })
  @ApiOperation({
    summary: "Get the authenticated user's relation to a single action",
  })
  async myStatus(
    @Request() req: JwtRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<UserActionRelationDto> {
    if (!req.user) {
      throw new UnauthorizedException('User not found');
    }
    const relation = await this.actionsService.getActionRelation(
      +id,
      req.user.sub,
    );
    if (!relation) {
      throw new NotFoundException('User action not found');
    }
    return { relation: relation };
  }

  @Get()
  @UseGuards(AuthOptionalGuard)
  @ApiOkResponse({ type: [ActionDto] })
  async findAll(@Request() req: JwtRequest): Promise<ActionDto[]> {
    return this.actionsService.findPublic(req.user?.sub);
  }

  @Get('loggedIn')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ActionDto] })
  async findAllLoggedIn(@Request() req: JwtRequest): Promise<ActionDto[]> {
    return this.actionsService.findPublic(req.user.sub);
  }

  @Get('myActivity')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ActionActivityDto] })
  async myActivity(@Request() req: JwtRequest) {
    return this.actionsService.getActivityForUser(req.user?.sub);
  }

  @Get('userlocations/:id')
  @ApiOkResponse({ type: [LatLonDto] })
  async userLocations(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<LatLonDto[]> {
    return this.actionsService.userCoordinatesForAction(id);
  }

  @Get('activities/feed')
  @Public()
  @ApiOkResponse({ type: [ActionActivityDto] })
  @ApiOperation({
    summary: 'Get recent activities from all actions for the feed',
  })
  async getActivityFeed(
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ): Promise<ActionActivityDto[]> {
    const limitNum = limit ? parseInt(limit) : 20;
    const beforeDate = before ? new Date(before) : undefined;
    if (before && isNaN(beforeDate!.getTime())) {
      throw new BadRequestException('Invalid "before" cursor');
    }
    return this.actionsService.getActivityFeed(limitNum, beforeDate);
  }

  @Get('activities/:id')
  @Public()
  @ApiOkResponse({ type: ActionActivityDto })
  async getActivity(@Param('id', ParseIntPipe) id: number) {
    return this.actionsService.getActivity(id);
  }

  @Get('events/:id')
  @Public()
  @ApiOkResponse({ type: ActionEventDto })
  async getEvent(@Param('id', ParseIntPipe) id: number) {
    return this.actionsService.getEvent(id);
  }

  @Get('notification-schedule')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: NotificationScheduleEntryDto, isArray: true })
  async getNotificationSchedule(
    @Query() query: NotificationScheduleQueryDto,
  ): Promise<NotificationScheduleEntryDto[]> {
    const start = new Date(query.windowStart);
    const end = new Date(query.windowEnd);

    const schedule = await this.actionsService.getNotificationSchedule(
      start,
      end,
    );

    return schedule.map((entry) => ({
      ...entry,
      scheduledFor: new Date(entry.scheduledFor),
    }));
  }

  @Get(':id/activities')
  @Public()
  @ApiOkResponse({ type: [ActionActivityDto] })
  @ApiOperation({ summary: 'Get recent activities for an action' })
  async getActionActivities(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ActionActivityDto[]> {
    return this.actionsService.getActionActivities(id);
  }

  @Get('all')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [ActionDto] })
  async findAllWithDrafts() {
    return this.actionsService.findAll();
  }

  @Sse('live/:id')
  @Public()
  @ApiOperation({ summary: 'SSE endpoint for join counts on a single action' })
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
  @ApiOperation({ summary: 'SSE endpoint for join counts on multiple actions' })
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

  @Get('friendActivity')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ActionActivityDto] })
  async friendActivity(@Request() req: JwtRequest) {
    return this.actionsService.friendActivity(req.user.sub);
  }

  @Get('slug/:id')
  @UseGuards(AuthOptionalGuard)
  @ApiOkResponse({ type: ActionDto })
  @ApiUnauthorizedResponse()
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: JwtRequest,
  ): Promise<ActionDto | null> {
    return this.actionsService.findOneDto(id, req.user?.sub);
  }

  @Post('create')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionDto })
  create(@Body() createActionDto: CreateActionDto) {
    return this.actionsService.create(createActionDto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateActionDto: UpdateActionDto,
    @Request() req: JwtRequest,
  ) {
    return this.actionsService.update(id, updateActionDto, req.user.sub);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.actionsService.remove(id);
  }

  @Get('completed/:id')
  @ApiOkResponse({ type: [ActionActivityDto] })
  async findCompletedForUser(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ActionActivityDto[]> {
    return this.actionsService.findCompletedForUser(+id);
  }

  @Post(':id/events')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionEvent })
  async addEvent(
    @Param('id', ParseIntPipe) id: number,
    @Body() actionEventDto: CreateActionEventDto,
    @Request() req: JwtRequest,
  ): Promise<ActionEvent> {
    return this.actionsService.addEvent(id, actionEventDto, req.user?.sub);
  }

  @Patch('remindergroups/:groupId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ReminderGroup })
  async updateReminderGroup(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() body: CreateTODReminderGroupDto,
  ): Promise<ReminderGroup> {
    return this.actionsService.updateReminderGroup(groupId, body);
  }

  @Post('events/:eventId/createremindergroup')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ReminderGroup })
  async createReminderGroup(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() body: CreateTODReminderGroupDto,
  ): Promise<ReminderGroup> {
    return this.actionsService.createdTimedReminderGroup(eventId, body);
  }

  @Delete('reminders/:groupId')
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteReminderGroup(@Param('groupId', ParseIntPipe) groupId: number) {
    this.actionsService.deleteReminderGroup(groupId);
  }

  @Get('plansForGroup/:groupId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: NotificationPlan, isArray: true })
  async plansForGroup(
    @Param('groupId', ParseIntPipe) groupId: number,
  ): Promise<NotificationPlan[]> {
    return this.actionsService.getNotificationPlansForGroup(groupId);
  }

  @Get('sentNotifsForGroup/:groupId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionEventNotifDto, isArray: true })
  async sentNotifsForGroup(
    @Param('groupId', ParseIntPipe) groupId: number,
  ): Promise<ActionEventNotifDto[]> {
    return this.actionsService.getSentNotifsForGroup(groupId);
  }

  @Post('clearDb')
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  clearDb() {
    return this.actionsService.clearDb();
  }

  @Post('setTestRelations')
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  setTestRelations(@Request() req: JwtRequest) {
    if (!req.user) {
      throw new UnauthorizedException('User not found');
    }
    return this.actionsService.setTestRelations(req.user.sub);
  }

  @Post('likeActivity/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionActivityDto })
  likeActivity(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: JwtRequest,
  ): Promise<ActionActivityDto> {
    return this.actionsService.likeActivity(id, req.user.sub);
  }

  @Post('unlikeActivity/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionActivityDto })
  unlikeActivity(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: JwtRequest,
  ): Promise<ActionActivityDto> {
    return this.actionsService.likeActivity(id, req.user.sub, true);
  }

  @Post('addActivityComment/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: CommentDto })
  addActivityComment(
    @Param('id', ParseIntPipe) id: number,
    @Body() commentDto: CreateCommentDto,
    @Request() req: JwtRequest,
  ): Promise<CommentDto> {
    return this.actionsService.addActivityComment(id, commentDto, req.user.sub);
  }

  @Post('updateActivity/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionActivityDto })
  updateActivity(
    @Param('id', ParseIntPipe) id: number,
    @Body() activityDto: UpdateActionActivityDto,
    @Request() req: JwtRequest,
  ): Promise<ActionActivityDto> {
    return this.actionsService.updateActivity(id, activityDto, req.user.sub);
  }

  @Get('preEventNotifData/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: PreEventNotifDataDto })
  eventNotifData(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PreEventNotifDataQueryDto,
  ): Promise<PreEventNotifDataDto> {
    return this.actionsService.eventNotifData(
      id,
      query.type,
      query.sendNotifsTo,
    );
  }

  @Post('createActivity')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionActivityDto })
  createActivity(
    @Body() activityDto: CreateActionActivityDto,
  ): Promise<ActionActivityDto> {
    return this.actionsService.adminCreateActivity(activityDto);
  }

  @Post('archive/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionDto })
  archive(@Param('id', ParseIntPipe) id: number): Promise<ActionDto> {
    return this.actionsService.archive(id);
  }

  @Post('unarchive/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionDto })
  unarchive(@Param('id', ParseIntPipe) id: number): Promise<ActionDto> {
    return this.actionsService.unarchive(id);
  }

  @Get('reminderGroupsForEvent/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ReminderGroup, isArray: true })
  reminderGroupsForEvent(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ReminderGroup[]> {
    return this.actionsService.getReminderGroupsForEvent(id);
  }

  @Post('createUpdate/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionUpdate })
  createUpdate(
    @Param('id', ParseIntPipe) id: number,
    @Body() createActionUpdateDto: CreateActionUpdateDto,
  ): Promise<ActionUpdate> {
    return this.actionsService.createActionUpdate(id, createActionUpdateDto);
  }

  @Get('suites')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuite, isArray: true })
  suites(): Promise<ActionSuite[]> {
    return this.actionsService.getSuites();
  }

  @Get('suite/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto })
  suite(@Param('id', ParseIntPipe) id: number): Promise<ActionSuiteDto> {
    return this.actionsService.getSuite(id);
  }

  @Post('createSuite')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto })
  createSuite(
    @Body() createActionSuiteDto: CreateActionSuiteDto,
  ): Promise<ActionSuiteDto> {
    return this.actionsService.createSuite(createActionSuiteDto);
  }

  @Patch('suite/:suiteId/batchUpdateSuiteEvents/:eventId')
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  batchUpdateSuiteEvents(
    @Param('suiteId', ParseIntPipe) suiteId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() body: UpdateActionEventDto,
  ) {
    return this.actionsService.batchUpdateSuiteEvents(suiteId, eventId, body);
  }

  @Post('suite/:suiteId/events')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto })
  async addSuiteEvent(
    @Param('suiteId', ParseIntPipe) suiteId: number,
    @Body() actionEventDto: CreateActionEventDto,
  ): Promise<ActionSuiteDto> {
    return this.actionsService.addSuiteEvent(suiteId, actionEventDto);
  }

  @Delete('suite/:suiteId/events/:eventId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto })
  async deleteSuiteEvent(
    @Param('suiteId', ParseIntPipe) suiteId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<ActionSuiteDto> {
    return this.actionsService.deleteSuiteEvent(suiteId, eventId);
  }

  @Post('events/:eventId/checkTentativePlans')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: NotificationPlan, isArray: true })
  async tentativePlansForGroup(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() body: CreateTODReminderGroupDto,
  ): Promise<NotificationPlan[]> {
    return this.actionsService.tentativePlansForGroup(eventId, body);
  }
}
