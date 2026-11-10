import { client } from "@alliance/shared/client/client.gen";
import { api, serveWaitlistApi } from "./WaitlistPage.testHarness";

serveWaitlistApi();

let release = () => {};
let lateRequest: Promise<unknown> = Promise.resolve();
let heldTestApi = api;

test("a search is still held when its test ends", async () => {
  heldTestApi = api;
  api.holdSearch = new Promise((resolve) => {
    release = resolve;
  });
  lateRequest = client.post({
    url: "/waitlist/admin/entries/search",
    body: {},
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
});

test("the held search records nothing into the next test's state", async () => {
  release();
  await lateRequest;
  expect(heldTestApi.searches).toHaveLength(1);
  expect(api.searches).toEqual([]);
});
