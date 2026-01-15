import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow, IsOptional } from 'class-validator';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum CustomValidatorType {
  UploadedPhoto = 'UploadedPhoto',
  SignedContract = 'SignedContract',
  AddedProfileDescription = 'AddedProfileDescription',
  RepliedToForumPost = 'RepliedToForumPost',
  HasPhoneNumber = 'HasPhoneNumber',
  IsPhoneNumberValid = 'IsPhoneNumberValid',
  MemberTag = 'MemberTag',
  MemberCommunity = 'MemberCommunity',
  AnyCommunity = 'AnyCommunity',
}

export const typeName: Record<CustomValidatorType, string> = {
  [CustomValidatorType.UploadedPhoto]: 'Uploaded Profile Picture',
  [CustomValidatorType.SignedContract]: 'Signed Contract',
  [CustomValidatorType.AddedProfileDescription]: 'Added Profile Description',
  [CustomValidatorType.RepliedToForumPost]: 'Replied to Forum Post',
  [CustomValidatorType.HasPhoneNumber]: 'Has Phone Number',
  [CustomValidatorType.IsPhoneNumberValid]: 'Entered phone number is valid',
  [CustomValidatorType.MemberTag]: 'Member has tag',
  [CustomValidatorType.MemberCommunity]: 'Member is in specific community',
  [CustomValidatorType.AnyCommunity]: 'Member is in any community',
};

export const typeUsesIdArgument: Record<CustomValidatorType, boolean> = {
  [CustomValidatorType.UploadedPhoto]: false,
  [CustomValidatorType.SignedContract]: false,
  [CustomValidatorType.AddedProfileDescription]: false,
  [CustomValidatorType.RepliedToForumPost]: true,
  [CustomValidatorType.HasPhoneNumber]: false,
  [CustomValidatorType.IsPhoneNumberValid]: false,
  [CustomValidatorType.MemberTag]: true,
  [CustomValidatorType.MemberCommunity]: true,
  [CustomValidatorType.AnyCommunity]: false,
};

export const typeUsableForVisibility: Record<CustomValidatorType, boolean> = {
  [CustomValidatorType.UploadedPhoto]: false,
  [CustomValidatorType.SignedContract]: false,
  [CustomValidatorType.AddedProfileDescription]: false,
  [CustomValidatorType.RepliedToForumPost]: false,
  [CustomValidatorType.HasPhoneNumber]: true,
  [CustomValidatorType.IsPhoneNumberValid]: false,
  [CustomValidatorType.MemberTag]: true,
  [CustomValidatorType.MemberCommunity]: true,
  [CustomValidatorType.AnyCommunity]: true,
};

@Entity()
export class CustomValidator {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column()
  @ApiProperty({
    enum: CustomValidatorType,
    enumName: 'CustomValidatorType',
  })
  @Allow()
  type: CustomValidatorType;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  idArgument?: string;
}
