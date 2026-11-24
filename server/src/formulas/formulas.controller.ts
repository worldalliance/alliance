import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import type { JwtPayload } from "src/auth/tokens";
import { ReqUser } from "src/auth/user.decorator";
import {
  FormulaDto,
  FormulaVersionDto,
  SaveFormulasDto,
  SaveFormulasResultDto,
} from "./dto/formula.dto";
import { FormulasService } from "./formulas.service";

@Controller("formulas")
@UseGuards(AdminGuard)
export class FormulasController {
  constructor(private readonly formulasService: FormulasService) {}

  @Get()
  @ApiOkResponse({ type: FormulaDto, isArray: true })
  async listAdmin(): Promise<FormulaDto[]> {
    return (await this.formulasService.list()).map(
      (formula) => new FormulaDto(formula),
    );
  }

  @Get(":id/versions")
  @ApiOkResponse({ type: FormulaVersionDto, isArray: true })
  @ApiResponse({ status: 404, description: "No formula has this id." })
  async versionsAdmin(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<FormulaVersionDto[]> {
    return (await this.formulasService.versions(id)).map(
      (version) => new FormulaVersionDto(version),
    );
  }

  @Post("save")
  @HttpCode(200)
  @ApiOkResponse({ type: SaveFormulasResultDto })
  @ApiResponse({
    status: 409,
    description: "A formula, list or split changed since the admin opened it.",
  })
  async saveAdmin(
    @Body() body: SaveFormulasDto,
    @ReqUser() user: JwtPayload,
  ): Promise<SaveFormulasResultDto> {
    return new SaveFormulasResultDto({
      problems: await this.formulasService.save({
        edits: body.edits,
        deletions: body.deletions,
        deletedLists: body.deletedLists ?? [],
        groupFixes: body.groupFixes ?? [],
        savedById: user.sub,
      }),
    });
  }
}
