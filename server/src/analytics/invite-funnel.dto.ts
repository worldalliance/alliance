import { ApiProperty } from "@nestjs/swagger";

export class InviteFunnelDto {
  @ApiProperty({ description: "Total one-time invites created" })
  invitesCreated: number;

  @ApiProperty({ description: "Invites that were used (user signed up)" })
  invitesUsed: number;

  @ApiProperty({
    description: "Invited users who signed the contract",
  })
  contractSigned: number;

  @ApiProperty({
    description: "Invited users who finished onboarding (completed 4+ actions)",
  })
  onboardingCompleted: number;

  constructor(input: InviteFunnel) {
    this.invitesCreated = input.invitesCreated;
    this.invitesUsed = input.invitesUsed;
    this.contractSigned = input.contractSigned;
    this.onboardingCompleted = input.onboardingCompleted;
  }
}

export type InviteFunnel = {
  invitesCreated: number;
  invitesUsed: number;
  contractSigned: number;
  onboardingCompleted: number;
};
