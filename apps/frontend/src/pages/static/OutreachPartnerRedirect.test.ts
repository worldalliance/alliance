import { loader } from "./OutreachPartnerRedirect";

const locationOf = (url: string) =>
  loader({ request: new Request(url) }).headers.get("Location");

test("sends /outreach-partner to /partner", () => {
  expect(locationOf("http://site.test/outreach-partner?x=1")).toBe("/partner");
});

test("keeps a tracked link's ID for the page to record", () => {
  expect(locationOf("http://site.test/outreach-partner?cid=t-1")).toBe(
    "/partner?cid=t-1",
  );
});
