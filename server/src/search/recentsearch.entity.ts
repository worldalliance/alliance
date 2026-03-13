import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { CreateDateColumnTz } from 'src/datasources/basecolumns';
import { SearchItemType } from './searchitem.dto';

@Entity()
export class RecentSearch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  objectId: number;

  @Column({
    type: 'enum',
    enum: SearchItemType,
  })
  objectType: SearchItemType;

  @Column()
  userId: number;

  @CreateDateColumnTz()
  createdAt: Date;
}
