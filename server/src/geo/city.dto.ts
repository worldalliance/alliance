import { PickType, ApiProperty } from '@nestjs/swagger';
import { City } from './city.entity';

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
