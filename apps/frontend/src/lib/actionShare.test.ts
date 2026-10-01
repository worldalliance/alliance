import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { copyActionShareText } from "./actionShare";

declare global {
  interface Window {
    happyDOM: { setURL: (url: string) => void };
  }
}

serveApi(
  routes({
    "POST /actions/:id/referralCode": () =>
      Response.json({ referralCode: "abc" }),
  }),
);

afterEach(() => {
  jest.restoreAllMocks();
  window.happyDOM.setURL("http://localhost:3000/");
});

it("copies the share text with a personal link on the domain the member loaded", async () => {
  window.happyDOM.setURL("https://thealliance.org/actions/5");
  const writeText = jest
    .spyOn(navigator.clipboard, "writeText")
    .mockResolvedValue();

  expect(
    await copyActionShareText({
      actionId: 5,
      isAuthenticated: true,
      template: "Hi from #{first-name}",
      userName: "Ada Lovelace",
    }),
  ).toBe(true);
  expect(writeText).toHaveBeenCalledWith(
    "Hi from Ada\n\nhttps://thealliance.org/actions/5?sid=abc",
  );
});
