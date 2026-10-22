import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { Public } from "../auth/public.decorator";
import { ReferrerProfileDto, SignupSocialProofDto } from "./dto/user.dto";
import { ReferralService } from "./referral.service";

@Controller("user")
export class UserReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Get("signupSocialProof")
  @Public()
  @ApiOperation({
    summary: "Member avatars for signup social proof (optional referral code)",
  })
  @ApiQuery({
    name: "code",
    required: false,
    description: "Referral or invite code to prefer inviter friends",
  })
  @ApiQuery({
    name: "count",
    required: false,
    type: Number,
    description: "How many avatars to return. Defaults to 5, capped at 24.",
  })
  @ApiOkResponse({ type: SignupSocialProofDto })
  async signupSocialProof(
    @Query("code") code?: string,
    @Query("count", new ParseIntPipe({ optional: true })) count?: number,
  ): Promise<SignupSocialProofDto> {
    return new SignupSocialProofDto(
      await this.referralService.getSignupSocialProof(code, count),
    );
  }

  @Get("referrerProfile/:code")
  @Public()
  @ApiOkResponse({ type: ReferrerProfileDto })
  async referrerProfile(
    @Param("code") code: string,
  ): Promise<ReferrerProfileDto> {
    const referrer = await this.referralService.resolveReferrer(code);
    if (!referrer) {
      throw new NotFoundException("Referrer not found");
    }
    return new ReferrerProfileDto(referrer);
  }
}
