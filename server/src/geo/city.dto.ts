import { PickType, ApiProperty } from '@nestjs/swagger';
import { City } from './city.entity';

export interface MapboxFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: number[];
  };
  properties: {
    name: string;
    name_preferred?: string;
    mapbox_id: string;
    feature_type: string;
    address?: string;
    full_address?: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
    context: {
      country: {
        id: string;
        name: string;
        country_code: string;
      };
      region: {
        id: string;
        name: string;
      };
    };
  };
}

export class UserCity {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  latitude: number;
  @ApiProperty()
  longitude: number;
  @ApiProperty()
  country?: string;
  @ApiProperty()
  region?: string;
}

export class CitySearchDto extends PickType(City, [
  'id',
  'name',
  'countryName',
  'countryCode',
  'admin1',
]) {}
