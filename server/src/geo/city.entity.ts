import { ApiProperty } from "@nestjs/swagger";
import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity()
export class City {
  @PrimaryColumn()
  @ApiProperty()
  id: number;

  @Column()
  @ApiProperty()
  @Index("idx_city_name_trgm", { synchronize: false })
  name: string;

  @Column({ nullable: true })
  @ApiProperty()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  asciiName: string;

  @Column({ type: "varchar", nullable: true })
  @Index("idx_city_english_name_trgm", { synchronize: false })
  @ApiProperty({ type: String, nullable: true })
  englishName: string | null;

  @Column({ type: "varchar", length: 20 })
  @ApiProperty()
  admin1: string;

  @Column({ type: "varchar", length: 80 })
  @ApiProperty()
  admin2: string;

  @Column({ type: "varchar", length: 2 })
  @ApiProperty()
  countryCode: string;

  @Column()
  @ApiProperty()
  countryName: string;

  @Column({ type: "float" })
  @ApiProperty()
  latitude: number;

  @Column({ type: "float" })
  @ApiProperty()
  longitude: number;
}
