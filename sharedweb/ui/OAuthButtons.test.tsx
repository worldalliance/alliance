import { OAuthProvider } from "@alliance/common/oauth";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import OAuthButtons from "./OAuthButtons";

afterEach(cleanup);

it.each(["click", "auxclick", "contextmenu"])(
  "builds the start URL on %s",
  (type) => {
    let clicked = false;
    render(
      <OAuthButtons
        hrefFor={(provider) =>
          `https://api.example.test/auth/${provider}/start?clicked=${clicked}`
        }
      />,
    );
    const link = screen.getByRole("link", { name: /Google/ });
    link.addEventListener("click", (event) => event.preventDefault());
    clicked = true;
    fireEvent(link, new MouseEvent(type, { bubbles: true }));
    expect(link.getAttribute("href")).toBe(
      `https://api.example.test/auth/${OAuthProvider.Google}/start?clicked=true`,
    );
  },
);
