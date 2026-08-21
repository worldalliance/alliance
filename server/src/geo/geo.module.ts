import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { City } from "./city.entity";
import { GeoController } from "./geo.controller";
import { GeoService } from "./geo.service";

@Module({
  imports: [TypeOrmModule.forFeature([City])],
  controllers: [GeoController],
  providers: [GeoService],
})
export class GeoModule {}
