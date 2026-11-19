import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FormulaVersion } from "./entities/formula-version.entity";
import { Formula } from "./entities/formula.entity";
import { FormulasController } from "./formulas.controller";
import { FormulasService } from "./formulas.service";

@Module({
  imports: [TypeOrmModule.forFeature([Formula, FormulaVersion])],
  controllers: [FormulasController],
  providers: [FormulasService],
})
export class FormulasModule {}
