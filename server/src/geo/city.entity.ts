import { Column, Entity, PrimaryColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class City {
  @PrimaryColumn()
  @ApiProperty()
  id: number;

  @Column()
  @ApiProperty()
  name: string;

  @Column({ type: 'varchar', length: 20 })
  @ApiProperty()
  admin1: string;

  @Column({ type: 'varchar', length: 80 })
  @ApiProperty()
  admin2: string;

  @Column({ type: 'varchar', length: 2 })
  @ApiProperty()
  countryCode: string;

  @Column()
  @ApiProperty()
  countryName: string;

  @Column({ type: 'float' })
  @ApiProperty()
  latitude: number;

  @Column({ type: 'float' })
  @ApiProperty()
  longitude: number;
}
