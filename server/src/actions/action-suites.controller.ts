import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AdminGuard } from "../auth/guards/admin.guard";
import {
  AcknowledgeDeadlineShortening,
  ApiAcknowledgeDeadlineShortening,
} from "./acknowledge-deadline-shortening";
import { ActionSuitesService } from "./action-suites.service";
import {
  CreateActionEventDto,
  UpdateActionEventDto,
} from "./dto/action-event.dto";
import { ActionSuiteDto, CreateActionSuiteDto } from "./dto/action-suite.dto";
import { SaveSuiteSplitDto, SuiteSplitDto } from "./dto/suite-split.dto";
import { SuiteSplitsService } from "./suite-splits.service";

@Controller("actions")
export class ActionSuitesController {
  constructor(
    private readonly actionSuites: ActionSuitesService,
    private readonly suiteSplits: SuiteSplitsService,
  ) {}

  @Get("suites")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto, isArray: true })
  async suitesAdmin(): Promise<ActionSuiteDto[]> {
    const suites = await this.actionSuites.findSuites();
    return suites.map((suite) => new ActionSuiteDto(suite, []));
  }

  @Get("suite/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto })
  async suiteAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ActionSuiteDto> {
    const suite = await this.actionSuites.findSuite(id);
    return new ActionSuiteDto(suite, suite.actions);
  }

  @Post("createSuite")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto })
  async createSuiteAdmin(
    @Body() createActionSuiteDto: CreateActionSuiteDto,
  ): Promise<ActionSuiteDto> {
    const suite = await this.actionSuites.createSuite(createActionSuiteDto);
    return new ActionSuiteDto(suite, []);
  }

  @Patch("suite/:suiteId/batchUpdateSuiteEvents/:eventId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto })
  @ApiAcknowledgeDeadlineShortening()
  async batchUpdateSuiteEventsAdmin(
    @Param("suiteId", ParseIntPipe) suiteId: number,
    @Param("eventId", ParseIntPipe) eventId: number,
    @Body() body: UpdateActionEventDto,
    @AcknowledgeDeadlineShortening()
    acknowledgeDeadlineShortening: boolean,
  ): Promise<ActionSuiteDto> {
    const suite = await this.actionSuites.batchUpdateSuiteEvents({
      suiteId,
      eventId,
      body,
      acknowledgeDeadlineShortening,
    });
    return new ActionSuiteDto(suite, suite.actions);
  }

  @Post("suite/:suiteId/events")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto })
  @ApiAcknowledgeDeadlineShortening()
  async addSuiteEventAdmin(
    @Param("suiteId", ParseIntPipe) suiteId: number,
    @Body() actionEventDto: CreateActionEventDto,
    @AcknowledgeDeadlineShortening()
    acknowledgeDeadlineShortening: boolean,
  ): Promise<ActionSuiteDto> {
    const suite = await this.actionSuites.addSuiteEvent({
      suiteId,
      event: actionEventDto,
      acknowledgeDeadlineShortening,
    });
    return new ActionSuiteDto(suite, suite.actions);
  }

  @Delete("suite/:suiteId/events/:eventId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto })
  async deleteSuiteEventAdmin(
    @Param("suiteId", ParseIntPipe) suiteId: number,
    @Param("eventId", ParseIntPipe) eventId: number,
  ): Promise<ActionSuiteDto> {
    const suite = await this.actionSuites.deleteSuiteEvent(suiteId, eventId);
    return new ActionSuiteDto(suite, suite.actions);
  }

  @Get("suite/:suiteId/splits")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: SuiteSplitDto, isArray: true })
  async suiteSplitsAdmin(
    @Param("suiteId", ParseIntPipe) suiteId: number,
  ): Promise<SuiteSplitDto[]> {
    return this.findSplits(suiteId);
  }

  @Post("suite/:suiteId/splits")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: SuiteSplitDto, isArray: true })
  async createSuiteSplitAdmin(
    @Param("suiteId", ParseIntPipe) suiteId: number,
    @Body() body: SaveSuiteSplitDto,
  ): Promise<SuiteSplitDto[]> {
    await this.suiteSplits.save({ suiteId, body, now: new Date() });
    return this.findSplits(suiteId);
  }

  @Put("suite/:suiteId/splits/:splitId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: SuiteSplitDto, isArray: true })
  async updateSuiteSplitAdmin(
    @Param("suiteId", ParseIntPipe) suiteId: number,
    @Param("splitId", ParseIntPipe) splitId: number,
    @Body() body: SaveSuiteSplitDto,
  ): Promise<SuiteSplitDto[]> {
    await this.suiteSplits.save({ suiteId, splitId, body, now: new Date() });
    return this.findSplits(suiteId);
  }

  @Delete("suite/:suiteId/splits/:splitId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: SuiteSplitDto, isArray: true })
  async deleteSuiteSplitAdmin(
    @Param("suiteId", ParseIntPipe) suiteId: number,
    @Param("splitId", ParseIntPipe) splitId: number,
  ): Promise<SuiteSplitDto[]> {
    await this.suiteSplits.remove({ suiteId, splitId, now: new Date() });
    return this.findSplits(suiteId);
  }

  private async findSplits(suiteId: number): Promise<SuiteSplitDto[]> {
    const splits = await this.suiteSplits.findForSuite(suiteId, new Date());
    return splits.map(
      ({ split, launched }) => new SuiteSplitDto(split, launched),
    );
  }
}
