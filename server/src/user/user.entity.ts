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
import { IsNotEmpty } from 'class-validator';
import { FriendStatus } from './friend.entity';
import { Friend } from './friend.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @ApiProperty()
  @IsNotEmpty()
  name: string;

  @Column({ unique: true })
  @ApiProperty()
  @IsNotEmpty()
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

  @OneToMany(() => Friend, (friend) => friend.requester)
  sentFriendRequests: Friend[];

  @OneToMany(() => Friend, (friend) => friend.addressee)
  receivedFriendRequests: Friend[];

  get friends(): User[] {
    const sentAccepted =
      this.sentFriendRequests
        ?.filter((f) => f.status === FriendStatus.Accepted)
        .map((f) => f.addressee) || [];
    const receivedAccepted =
      this.receivedFriendRequests
        ?.filter((f) => f.status === FriendStatus.Accepted)
        .map((f) => f.requester) || [];
    return [...sentAccepted, ...receivedAccepted];
  }

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
