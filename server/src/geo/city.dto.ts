import { CityFieldValue } from "@alliance/common/forms/form-schema";
import { Assert } from "@alliance/common/types";
import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { City } from "./city.entity";

export class UserCity {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  latitude: number;
  @ApiProperty()
  longitude: number;
  @ApiPropertyOptional()
  country?: string;
  @ApiPropertyOptional()
  region?: string;
}

export class CitySearchDto extends PickType(City, [
  "id",
  "name",
  "countryName",
  "countryCode",
  "admin1",
]) {
  constructor(city: City) {
    super();
    this.id = city.id;
    this.name = city.name;
    this.countryName = city.countryName;
    this.countryCode = city.countryCode;
    this.admin1 = city.admin1;
  }
}

export class MaybeUserLocationDto {
  @ApiPropertyOptional({ type: () => City })
  @Type(() => City)
  city?: City;

  constructor(city: City | undefined) {
    this.city = city;
  }
}

type _typecheck = Assert<CitySearchDto extends CityFieldValue ? true : false>;
