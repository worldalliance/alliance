import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserDto } from "../../user/dto/user.dto";
import { User } from "../../user/entities/user.entity";

export class RefreshTokensResponseDto {
  @ApiPropertyOptional()
  access_token?: string;

  @ApiPropertyOptional()
  refresh_token?: string;

  constructor(input: RefreshTokensResponse) {
    this.access_token = input.access_token;
    this.refresh_token = input.refresh_token;
  }
}

export type RefreshTokensResponse = {
  access_token?: string;
  refresh_token?: string;
};

export class AccessToken {
  @ApiProperty()
  access_token: string;
}

export type AuthMeResponse = {
  user: User;
  isImpersonation?: boolean;
};

export class AuthMeResponseDto {
  @ApiProperty({ type: () => UserDto })
  user: UserDto;

  @ApiPropertyOptional()
  isImpersonation?: boolean;

  constructor(input: AuthMeResponse) {
    this.user = new UserDto(input.user);
    this.isImpersonation = input.isImpersonation;
  }
}
