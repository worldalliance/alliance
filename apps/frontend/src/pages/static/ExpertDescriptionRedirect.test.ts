import { loader } from "./ExpertDescriptionRedirect";

const locationOf = (url: string) =>
  loader({ request: new Request(url) }).headers.get("Location");

test("sends /description to the guide", () => {
  expect(locationOf("http://site.test/description?x=1")).toBe("/guide");
});

test("keeps a tracked link's ID for the page to record", () => {
  expect(locationOf("http://site.test/description?cid=t-1")).toBe(
    "/guide?cid=t-1",
  );
});
