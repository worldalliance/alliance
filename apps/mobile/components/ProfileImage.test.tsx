import { fireEvent, render } from "@testing-library/react";
import { expect, it } from "bun:test";
import ProfileImage from "./ProfileImage";

const picture = (container: HTMLElement) => container.querySelector("img");

it("shows the placeholder once a picture fails to load, and the next picture again", () => {
  const { container, rerender } = render(
    <ProfileImage pfp="https://example.org/a.webp" size="small" />,
  );
  fireEvent.error(picture(container)!);
  expect(picture(container)).toBeNull();

  rerender(<ProfileImage pfp="https://example.org/b.webp" size="small" />);
  expect(picture(container)?.getAttribute("src")).toContain("b.webp");
});

it("shows the placeholder when there is no picture", () => {
  const { container } = render(<ProfileImage pfp={null} size="small" />);
  expect(picture(container)).toBeNull();
});
