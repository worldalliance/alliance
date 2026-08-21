import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiQuery } from "@nestjs/swagger";
import { CitySearchDto } from "./city.dto";
import { GeoService } from "./geo.service";

@Controller("geo")
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get("search-city")
  @ApiQuery({ name: "query", type: String, required: true })
  @ApiQuery({ name: "latitude", type: Number, required: false })
  @ApiQuery({ name: "longitude", type: Number, required: false })
  @ApiOkResponse({ type: [CitySearchDto] })
  async searchCity(
    @Query("query") query: string,
    @Query("latitude") latitude: number,
    @Query("longitude") longitude: number,
  ): Promise<CitySearchDto[]> {
    const cities = await this.geoService.searchCity(query, latitude, longitude);
    return cities.map((city) => new CitySearchDto(city));
  }

  @Get("load-country-data")
  @ApiOkResponse()
  async loadCountryData(): Promise<void> {
    return this.geoService.loadCityDataFromTxt();
  }
}
