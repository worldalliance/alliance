import { makeUser } from "@alliance/shared/lib/testFixtures";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { describe, expect, it, mock } from "bun:test";
import { refreshUser } from "./refreshUser";

const user = makeUser();
let respond = () => Response.json({ user });

serveApi(routes({ "GET /auth/me": () => respond() }));

const refreshed = async () => {
  const setUser = mock();
  await refreshUser(setUser);
  return setUser;
};

describe("refreshUser", () => {
  it("stores the signed-in member", async () => {
    respond = () => Response.json({ user });
    expect(await refreshed()).toHaveBeenCalledWith(user);
  });

  it("keeps the member signed in when /auth/me fails", async () => {
    respond = () => Response.json({}, { status: 500 });
    expect(await refreshed()).not.toHaveBeenCalled();
  });

  it("keeps the member signed in when /auth/me returns an empty body", async () => {
    respond = () =>
      new Response(null, { status: 200, headers: { "Content-Length": "0" } });
    expect(await refreshed()).not.toHaveBeenCalled();
  });
});
