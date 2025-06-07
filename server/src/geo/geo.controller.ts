import { Controller, Get, Ip, Query, Req } from '@nestjs/common';
import { GeoService } from './geo.service';
import { ApiQuery } from '@nestjs/swagger';
import { ApiResponse } from '@nestjs/swagger';
import { CitySearchDto } from './city.dto';
import { City } from './city.entity';

@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('search-city')
  @ApiQuery({ name: 'query', type: String, required: true })
  @ApiQuery({ name: 'latitude', type: Number, required: false })
  @ApiQuery({ name: 'longitude', type: Number, required: false })
  @ApiResponse({ type: [CitySearchDto] })
  async searchCity(
    @Query('query') query: string,
    @Query('latitude') latitude: number,
    @Query('longitude') longitude: number,
  ): Promise<CitySearchDto[]> {
    return this.geoService.searchCity(query, latitude, longitude);
  }

  @Get('load-country-data')
  async loadCountryData(): Promise<City[]> {
    return this.geoService.loadCityDataFromTxt();
  }

  @Get('ip')
  async loadCityData(@Ip() ip: string, @Req() req: Request) {
    const data = await fetch(`https://ip-api.com/json/${ip}`).then((res) =>
      res.json(),
    );

    const headers = req.headers;

    return {
      ip,
      data,
      headers,
    };
  }
}
