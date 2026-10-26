import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AdminGuard } from "../auth/guards/admin.guard";
import {
  AcknowledgeDeadlineShortening,
  ApiAcknowledgeDeadlineShortening,
} from "./acknowledge-deadline-shortening";
import { ActionsService } from "./actions.service";
import {
  CreateActionEventDto,
  UpdateActionEventDto,
} from "./dto/action-event.dto";
import { ActionSuiteDto, CreateActionSuiteDto } from "./dto/action-suite.dto";

@Controller("actions")
export class ActionSuitesController {
  constructor(private readonly actionsService: ActionsService) {}

  @Get("suites")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto, isArray: true })
  async suitesAdmin(): Promise<ActionSuiteDto[]> {
    const suites = await this.actionsService.findSuites();
    return suites.map((suite) => new ActionSuiteDto(suite, []));
  }

  @Get("suite/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto })
  async suiteAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ActionSuiteDto> {
    const suite = await this.actionsService.findSuite(id);
    return new ActionSuiteDto(suite, suite.actions);
  }

  @Post("createSuite")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto })
  async createSuiteAdmin(
    @Body() createActionSuiteDto: CreateActionSuiteDto,
  ): Promise<ActionSuiteDto> {
    const suite = await this.actionsService.createSuite(createActionSuiteDto);
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
    const suite = await this.actionsService.batchUpdateSuiteEvents({
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
    const suite = await this.actionsService.addSuiteEvent({
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
    const suite = await this.actionsService.deleteSuiteEvent(suiteId, eventId);
    return new ActionSuiteDto(suite, suite.actions);
  }
}
