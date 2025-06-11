import { ApiProperty } from '@nestjs/swagger';
import { City } from 'src/geo/city.entity';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class PrefillUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @ApiProperty()
  firstName: string;

  @Column()
  @ApiProperty()
  lastName: string;

  @Column()
  @ApiProperty()
  email: string;

  @Column()
  @ApiProperty()
  phone: string;

  @ManyToOne(() => City)
  @ApiProperty()
  city: City;
}
