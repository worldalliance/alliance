import { ApiProperty, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ShareUrl } from "src/share-urls/entities/share-url.entity";
import { ProfileDto } from "src/user/dto/user.dto";
import { User } from "src/user/entities/user.entity";

export class ShareUrlDto extends PickType(ShareUrl, ["url", "sid", "id"]) {
  @ApiProperty({ type: ProfileDto })
  @Type(() => ProfileDto)
  user: ProfileDto;

  constructor(shareUrl: ShareUrl) {
    super();
    this.url = shareUrl.url;
    this.sid = shareUrl.sid;
    this.id = shareUrl.id;
    this.user = new ProfileDto(shareUrl.user!);
  }
}

export type ShareUrlStats = {
  user: User;
  inviteCount: number;
  sid: string;
  yesCount: number;
};

export class ShareUrlStatsDto {
  @ApiProperty({ type: ProfileDto })
  @Type(() => ProfileDto)
  user: ProfileDto;

  @ApiProperty()
  inviteCount: number;

  @ApiProperty()
  sid: string;

  @ApiProperty()
  yesCount: number;

  constructor(input: ShareUrlStats) {
    this.user = new ProfileDto(input.user);
    this.inviteCount = input.inviteCount;
    this.sid = input.sid;
    this.yesCount = input.yesCount;
  }
}
