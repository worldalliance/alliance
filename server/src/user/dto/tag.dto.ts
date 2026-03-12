import { ApiProperty, OmitType, PickType } from '@nestjs/swagger';
import { Tag } from '../entities/tag.entity';
import { ProfileDto } from './user.dto';
import { Type } from 'class-transformer';
import { Allow, IsNumber } from 'class-validator';

export class TagDto extends OmitType(Tag, ['users']) {
  @Allow()
  @ApiProperty({ type: ProfileDto, isArray: true })
  @Type(() => ProfileDto)
  users: ProfileDto[];

  constructor(tag: Tag) {
    super();
    Object.assign(this, tag);
    this.users = tag.users ? tag.users.map((user) => new ProfileDto(user)) : [];
  }
}

export class CreateTagDto extends PickType(TagDto, [
  'name',
  'description',
  'publicDisplayName',
]) {}

export class AddUserToTagDto {
  @ApiProperty()
  @IsNumber()
  userId: number;
}
