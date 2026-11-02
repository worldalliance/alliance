import { loader } from "./SaferChatbotsRedirect";

const locationOf = (url: string) =>
  loader({ request: new Request(url) }).headers.get("Location");

test("sends /safer-chatbots to the project page", () => {
  expect(locationOf("http://site.test/safer-chatbots?x=1")).toBe(
    "/projects/safer-chatbots-for-children",
  );
});

test("keeps a tracked link's ID for the page to record", () => {
  expect(locationOf("http://site.test/safer-chatbots?cid=t-1")).toBe(
    "/projects/safer-chatbots-for-children?cid=t-1",
  );
});
