import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, spyOn, test } from "bun:test";
import { REVIEW_DEMO } from "./copy";
import { ReviewDemoVideo } from "./ReviewDemoVideo";

const prefersReducedMotion = (matches: boolean) =>
  spyOn(window, "matchMedia").mockReturnValue(
    Object.assign(new EventTarget(), {
      matches,
      media: "",
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
    }),
  );

afterEach(() => {
  spyOn(window, "matchMedia").mockRestore();
});

const video = () => screen.getByLabelText<HTMLVideoElement>(REVIEW_DEMO.label);

test("autoplays muted on a loop without controls", () => {
  prefersReducedMotion(false);
  render(<ReviewDemoVideo />);
  expect(video().autoplay).toBe(true);
  expect(video().muted).toBe(true);
  expect(video().loop).toBe(true);
  expect(video().controls).toBe(false);
  expect(screen.queryByRole("button", { name: "Play demo" })).toBeNull();
});

test("waits for a tap to play under reduced motion", () => {
  prefersReducedMotion(true);
  render(<ReviewDemoVideo />);
  expect(video().autoplay).toBe(false);
  const play = spyOn(video(), "play").mockResolvedValue();
  fireEvent.click(screen.getByRole("button", { name: "Play demo" }));
  expect(play).toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Play demo" })).toBeNull();
});
