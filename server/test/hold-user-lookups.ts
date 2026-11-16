import { UserService } from "src/user/user.service";
import type { TestContext } from "./e2e-test-utils";
import { rendezvous } from "./rendezvous";

/** Holds the first two UserService.findOneOrFail calls until both return.
 * That lookup is createActionActivity's last read before the transaction
 * holding its duplicate check, so two racing creations then open that
 * transaction together. */
export function holdUserLookups(ctx: TestContext) {
  const users = ctx.app.get(UserService);
  const findOneOrFail = users.findOneOrFail.bind(users);
  const bothReturned = rendezvous({ parties: 2, timeoutMs: 5000 });
  return jest
    .spyOn(users, "findOneOrFail")
    .mockImplementation(async (...args) => {
      const user = await findOneOrFail(...args);
      await bothReturned();
      return user;
    });
}
