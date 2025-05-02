import * as bcrypt from 'bcryptjs';
import { Exclude } from 'class-transformer';

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  OneToMany,
  ManyToMany,
} from 'typeorm';
import { UserAction } from '../actions/entities/user-action.entity';
import { ApiProperty } from '@nestjs/swagger';
import { Communique } from '../communiques/entities/communique.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @ApiProperty()
  name: string;

  @Column({ unique: true })
  @ApiProperty()
  email: string;

  @Column()
  @Exclude()
  @ApiProperty()
  password: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: false })
  @ApiProperty()
  admin: boolean;

  @ManyToMany(() => Communique, (communique) => communique.usersRead)
  communiquesRead: Communique[];

  @OneToMany(() => UserAction, (userAction) => userAction.user)
  actionRelations: UserAction[];

  constructor(data: Partial<User> = {}) {
    Object.assign(this, data);
  }

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword(): Promise<void> {
    const salt = await bcrypt.genSalt();
    if (!/^\$2[abxy]?\$\d+\$/.test(this.password)) {
      this.password = await bcrypt.hash(this.password, salt);
    }
  }

  async checkPassword(plainPassword: string): Promise<boolean> {
    return await bcrypt.compare(plainPassword, this.password);
  }
}
