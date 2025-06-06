import { Module } from '@nestjs/common';
import { GeoService } from './geo.service';
import { GeoController } from './geo.controller';

@Module({
  controllers: [GeoController],
  providers: [GeoService],
})
export class GeoModule {}
