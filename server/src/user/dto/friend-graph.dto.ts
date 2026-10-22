import { ApiProperty } from "@nestjs/swagger";

export type FriendGraphEdge = {
  userAId: number;
  userBId: number;
};

export class FriendGraphEdgeDto {
  @ApiProperty()
  userAId: number;

  @ApiProperty()
  userBId: number;

  constructor(input: FriendGraphEdge) {
    this.userAId = input.userAId;
    this.userBId = input.userBId;
  }
}
