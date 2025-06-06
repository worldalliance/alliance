import { SearchBoxCore } from '@mapbox/search-js-core';
import { SessionToken } from '@mapbox/search-js-core';
import { Injectable } from '@nestjs/common';
import { CitySearchDto } from './city.dto';

@Injectable()
export class GeoService {
  private search: SearchBoxCore;
  private sessionToken: SessionToken;
  constructor() {
    this.search = new SearchBoxCore({
      accessToken: process.env.MAPBOX_ACCESS_TOKEN,
    });

    this.sessionToken = new SessionToken();
  }

  async searchCity(query: string): Promise<CitySearchDto[]> {
    const result = await this.search.suggest(query, {
      sessionToken: this.sessionToken,
      types: 'place',
      limit: 10,
    });
    if (result.suggestions.length === 0) return [];

    const cities: CitySearchDto[] = result.suggestions.map((suggestion) => {
      return {
        id: suggestion.mapbox_id,
        name: suggestion.name,
        country: suggestion.context.country?.name,
        region: suggestion.context.region?.name,
      } satisfies CitySearchDto;
    });

    return cities;
  }
}
