import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import { AuthGuard } from "src/auth/guards/auth.guard";
import type { JwtRequest } from "src/auth/tokens";
import {
  CreateCustomValidatorDto,
  CreateCustomValidatorResponseDto,
  CustomValidatorDto,
  CustomValidatorResponseDto,
  CustomValidatorTypeDto,
  RunValidatorDto,
  TestCustomExpressionDto,
  TestCustomExpressionResponseDto,
} from "./customvalidator.dto";
import { CustomValidatorService } from "./customvalidator.service";

@Controller("tasks")
export class CustomValidatorController {
  constructor(
    private readonly customValidatorService: CustomValidatorService,
  ) {}

  @Get("customValidators")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CustomValidatorTypeDto, isArray: true })
  async customValidatorsAdmin(): Promise<CustomValidatorTypeDto[]> {
    const types = await this.customValidatorService.customValidators();
    return types.map((t) => new CustomValidatorTypeDto(t));
  }

  @Post("runValidator/:id")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: CustomValidatorResponseDto })
  async runValidator(
    @Param("id", ParseIntPipe) id: number,
    @Request() req: JwtRequest,
    @Body() body: RunValidatorDto,
  ): Promise<CustomValidatorResponseDto> {
    return new CustomValidatorResponseDto(
      await this.customValidatorService.runValidator(
        id,
        req.user.sub,
        body.fieldValue,
      ),
    );
  }

  @Post("runValidator/:id/asUser/:userId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CustomValidatorResponseDto })
  async runValidatorAsUserAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Param("userId", ParseIntPipe) userId: number,
    @Body() body: RunValidatorDto,
  ): Promise<CustomValidatorResponseDto> {
    return new CustomValidatorResponseDto(
      await this.customValidatorService.runValidator(
        id,
        userId,
        body.fieldValue,
      ),
    );
  }

  @Get("findOneCustomValidator/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CustomValidatorDto })
  async findOneCustomValidatorAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<CustomValidatorDto> {
    return new CustomValidatorDto(
      await this.customValidatorService.findOneCustomValidator(id),
    );
  }

  @Post("createCustomValidator")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CreateCustomValidatorResponseDto })
  async createCustomValidatorAdmin(
    @Body() body: CreateCustomValidatorDto,
  ): Promise<CreateCustomValidatorResponseDto> {
    const validator =
      await this.customValidatorService.findOrCreateCustomValidator({
        type: body.type,
        idArgument: body.idArgument,
        expression: body.expression,
      });
    return new CreateCustomValidatorResponseDto(validator.id);
  }

  @Post("testCustomExpression")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: TestCustomExpressionResponseDto })
  async testCustomExpressionAdmin(
    @Body() body: TestCustomExpressionDto,
  ): Promise<TestCustomExpressionResponseDto> {
    return new TestCustomExpressionResponseDto(
      await this.customValidatorService.testCustomExpression(
        body.expression,
        body.userId,
      ),
    );
  }
}
