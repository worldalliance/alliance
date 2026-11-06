import { Campaign } from "src/campaign/entities/campaign.entity";
import {
  ContractEvent,
  ContractEventType,
} from "../entities/contract-event.entity";
import { User } from "../entities/user.entity";
import { ProfileDto, ReferrerProfileDto, UserDto } from "./user.dto";

function userWithTiedEvents(): User {
  const date = new Date("2026-03-01T00:00:00Z");
  const signed = Object.assign(new ContractEvent(), {
    id: 1,
    date,
    type: ContractEventType.SIGNED,
    automatic: false,
    contractId: 1,
  });
  const suspended = Object.assign(new ContractEvent(), {
    id: 2,
    date,
    type: ContractEventType.SUSPENDED,
    automatic: false,
    contractId: null,
  });
  return Object.assign(new User(), {
    id: 1,
    name: "Tied Member",
    profilePicture: null,
    contractEvents: [signed, suspended],
  });
}

describe("ReferrerProfileDto", () => {
  it("carries a campaign invite page description", () => {
    const campaign = Object.assign(new Campaign(), {
      name: "Open Day",
      picture: null,
      invitePageDescription: "Join us Saturday",
    });
    expect(
      new ReferrerProfileDto({ kind: "campaign", campaign }),
    ).toMatchObject({
      kind: "campaign",
      displayName: "Open Day",
      invitePageDescription: "Join us Saturday",
    });
  });

  it("has no invite page description for a member", () => {
    const user = Object.assign(new User(), {
      name: "Alex",
      anonymous: false,
      profilePicture: null,
    });
    expect(new ReferrerProfileDto({ kind: "user", user })).toMatchObject({
      kind: "user",
      invitePageDescription: null,
    });
  });
});

describe("lastContractEvent", () => {
  it("breaks a same-instant tie by the higher id on UserDto and ProfileDto", () => {
    const user = userWithTiedEvents();
    expect(new UserDto(user).lastContractEvent?.type).toBe(
      ContractEventType.SUSPENDED,
    );
    expect(new ProfileDto(user).lastContractEvent?.type).toBe(
      ContractEventType.SUSPENDED,
    );
  });

  it("leaves the user's contractEvents in their loaded order", () => {
    const user = userWithTiedEvents();
    const loaded = [...(user.contractEvents ?? [])];
    new ProfileDto(user);
    expect(user.contractEvents).toEqual(loaded);
  });
});
