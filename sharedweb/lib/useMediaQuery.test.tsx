import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useMediaQuery } from "./useMediaQuery";

declare const happyDOM: { setViewport: (viewport: { width: number }) => void };

const firstRender = (query: string) => {
  const seen: boolean[] = [];
  renderHook(() => {
    const matches = useMediaQuery(query);
    seen.push(matches);
    return matches;
  });
  return seen[0];
};

it("reads whether a query matches on its first render", () => {
  const width = window.innerWidth;
  expect(firstRender(`(min-width: ${width}px)`)).toBe(true);
  expect(firstRender(`(min-width: ${width + 1}px)`)).toBe(false);
});

describe("as the viewport changes", () => {
  const width = window.innerWidth;
  afterEach(() => act(() => happyDOM.setViewport({ width })));

  it("follows it", () => {
    const { result } = renderHook(() =>
      useMediaQuery(`(min-width: ${width + 100}px)`),
    );
    expect(result.current).toBe(false);
    act(() => happyDOM.setViewport({ width: width + 200 }));
    expect(result.current).toBe(true);
  });
});

it("renders as non-matching on the server", () => {
  const Matches = () => <>{String(useMediaQuery("(min-width: 0px)"))}</>;
  expect(renderToString(<Matches />)).toBe("false");
});
