import { Controller, Get, Query } from '@nestjs/common';
import { GeoService } from './geo.service';
import { ApiQuery } from '@nestjs/swagger';
import { ApiResponse } from '@nestjs/swagger';
import { CitySearchDto } from './city.dto';

@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('search-city')
  @ApiQuery({ name: 'query', type: String, required: true })
  @ApiResponse({ type: [CitySearchDto] })
  async searchCity(
    @Query('query') query: string,
    // @Ip() ip: string,
  ): Promise<CitySearchDto[]> {
    return this.geoService.searchCity(query);
  }
}
