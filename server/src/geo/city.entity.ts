import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class City {
  @PrimaryColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'varchar', length: 20 })
  admin1: string;

  @Column({ type: 'varchar', length: 80 })
  admin2: string;

  @Column({ type: 'varchar', length: 2 })
  countryCode: string;

  @Column()
  countryName: string;

  @Column({ type: 'float' })
  latitude: number;

  @Column({ type: 'float' })
  longitude: number;
}
