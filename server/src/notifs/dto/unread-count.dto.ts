import { ApiProperty } from "@nestjs/swagger";

export class UnreadCountDto {
  @ApiProperty({ type: Number })
  unreadCount: number;

  constructor(unreadCount: number) {
    this.unreadCount = unreadCount;
  }
}
