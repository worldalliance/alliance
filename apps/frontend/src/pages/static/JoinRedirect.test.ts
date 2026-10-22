import { loader } from "./JoinRedirect";

const locationOf = (url: string) =>
  loader({ request: new Request(url) }).headers.get("Location");

test("sends /join to the waitlist page", () => {
  expect(locationOf("http://site.test/join")).toBe(
    "/projects/democratic-grantmaking-26",
  );
});

test("keeps the waitlist's referral parameters and drops the rest", () => {
  expect(
    locationOf("http://site.test/join?ref=abc&utm_source=x&link=acme"),
  ).toBe("/projects/democratic-grantmaking-26?link=acme&ref=abc");
});

test("keeps a tracked link's ID for the page to record", () => {
  expect(locationOf("http://site.test/join?cid=track-1")).toBe(
    "/projects/democratic-grantmaking-26?cid=track-1",
  );
});
