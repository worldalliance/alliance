import {
  ContractEvent,
  ContractEventType,
} from "../entities/contract-event.entity";
import { User } from "../entities/user.entity";
import { ProfileDto, UserDto } from "./user.dto";

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
