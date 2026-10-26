import { actionUpdateEmailHtml } from "./action-update-email";

describe("actionUpdateEmailHtml", () => {
  const { APP_URL, ALT_APP_URL } = process.env;
  beforeEach(() => {
    process.env.APP_URL = "https://app.example.org";
    delete process.env.ALT_APP_URL;
  });
  afterEach(() => {
    process.env.APP_URL = APP_URL;
    process.env.ALT_APP_URL = ALT_APP_URL;
  });

  it("points site paths and upload keys at the site", () => {
    expect(
      actionUpdateEmailHtml(
        "[post](/forum/post/20) ![](1765.webp) [ext](https://other.example.com/x)",
      ),
    ).toBe(
      '<p><a href="https://app.example.org/forum/post/20">post</a> <img src="https://app.example.org/api/images/1765.webp" alt=""> <a href="https://other.example.com/x">ext</a></p>\n',
    );
  });

  it("leaves a script link unlinked", () => {
    expect(actionUpdateEmailHtml("[x](javascript:alert(1))")).not.toContain(
      "href",
    );
  });

  it("passes an HTML block through", () => {
    expect(actionUpdateEmailHtml("<table><tr><td>1</td></tr></table>")).toBe(
      "<table><tr><td>1</td></tr></table>",
    );
  });
});
