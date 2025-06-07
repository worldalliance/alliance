import { Module } from '@nestjs/common';
import { GeoService } from './geo.service';
import { GeoController } from './geo.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { City } from './city.entity';

@Module({
  imports: [TypeOrmModule.forFeature([City])],
  controllers: [GeoController],
  providers: [GeoService],
})
export class GeoModule {}
