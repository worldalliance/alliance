import { loader } from "./ProgressProjectRedirect";

const locationOf = (url: string) =>
  loader({ params: { slug: "acme" }, request: new Request(url) }).headers.get(
    "Location",
  );

test("sends an old project URL to its project page", () => {
  expect(locationOf("http://site.test/progress/projects/acme?x=1")).toBe(
    "/projects/acme",
  );
});

test("keeps a tracked link's ID for the page to record", () => {
  expect(locationOf("http://site.test/progress/projects/acme?cid=t-1")).toBe(
    "/projects/acme?cid=t-1",
  );
});
