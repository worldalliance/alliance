import { Friend } from "./entities/friend.entity";
import { User } from "./entities/user.entity";
import { friendOf, friendshipBetween } from "./friendship";

describe("friendshipBetween", () => {
  it("names the same row whichever user comes first", () => {
    expect(friendshipBetween(7, 3)).toEqual(friendshipBetween(3, 7));
    expect(friendshipBetween(7, 3)).toEqual({ lowUserId: 3, highUserId: 7 });
  });
});

describe("friendOf", () => {
  const requester = new User({ id: 1 });
  const addressee = new User({ id: 2 });
  const friendship = Object.assign(new Friend(), { requester, addressee });

  it("returns the addressee to the requester and the requester to the addressee", () => {
    expect(friendOf(friendship, requester.id)).toBe(addressee);
    expect(friendOf(friendship, addressee.id)).toBe(requester);
  });
});
