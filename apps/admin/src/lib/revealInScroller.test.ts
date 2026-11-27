import { revealInScroller } from "./revealInScroller";

const rect = (top: number, height: number) => new DOMRect(0, top, 0, height);

const mount = ({
  top,
  height = 20,
  overflowY = "auto",
}: {
  top: number;
  height?: number;
  overflowY?: string;
}) => {
  const page = document.createElement("main");
  page.style.overflowY = "auto";
  const list = document.createElement("aside");
  list.style.overflowY = overflowY;
  const entry = document.createElement("button");
  list.append(entry);
  page.append(list);
  document.body.append(page);
  list.getBoundingClientRect = () => rect(98, 204);
  Object.defineProperty(list, "clientTop", { value: 2 });
  Object.defineProperty(list, "clientHeight", { value: 200 });
  entry.getBoundingClientRect = () => rect(top, height);
  list.scrollTop = 50;
  page.scrollTop = 70;
  revealInScroller(entry);
  const result = { list: list.scrollTop, page: page.scrollTop };
  page.remove();
  return result;
};

it("scrolls the nearest scroller down to an entry below it, inside its borders, and no further out", () => {
  expect(mount({ top: 310 })).toEqual({ list: 80, page: 70 });
});

it("treats an overflow-y: scroll ancestor as the scroller", () => {
  expect(mount({ top: 310, overflowY: "scroll" })).toEqual({
    list: 80,
    page: 70,
  });
});

it("scrolls up to an entry above it", () => {
  expect(mount({ top: 90 })).toEqual({ list: 40, page: 70 });
});

it("leaves a visible entry where it is", () => {
  expect(mount({ top: 150 })).toEqual({ list: 50, page: 70 });
});

it("aligns the top of an entry taller than the scroller", () => {
  expect(mount({ top: 120, height: 300 })).toEqual({ list: 70, page: 70 });
});

it("stops at the nearest scroller even when its content fits", () => {
  const page = document.createElement("main");
  page.style.overflowY = "auto";
  const list = document.createElement("aside");
  list.style.overflowY = "auto";
  const entry = document.createElement("button");
  list.append(entry);
  page.append(list);
  document.body.append(page);
  page.scrollTop = 70;
  entry.getBoundingClientRect = () => rect(-500, 20);
  revealInScroller(entry);
  expect(page.scrollTop).toBe(70);
  page.remove();
});

it("measures the document scroller against the viewport", () => {
  const html = document.documentElement;
  html.style.overflowY = "auto";
  const entry = document.createElement("button");
  document.body.append(entry);
  html.getBoundingClientRect = () => rect(-300, 2000);
  Object.defineProperty(html, "clientHeight", {
    value: 600,
    configurable: true,
  });
  html.scrollTop = 300;
  entry.getBoundingClientRect = () => rect(100, 20);
  revealInScroller(entry);
  expect(html.scrollTop).toBe(300);
  entry.getBoundingClientRect = () => rect(700, 20);
  revealInScroller(entry);
  expect(html.scrollTop).toBe(420);
  entry.remove();
  html.style.overflowY = "";
});

it("scrolls the document for a body whose overflow the viewport takes", () => {
  const html = document.documentElement;
  const { body } = document;
  html.style.overflowY = "visible";
  body.style.overflowY = "auto";
  const entry = document.createElement("button");
  body.append(entry);
  Object.defineProperty(html, "clientHeight", {
    value: 600,
    configurable: true,
  });
  html.scrollTop = 300;
  entry.getBoundingClientRect = () => rect(700, 20);
  revealInScroller(entry);
  expect(html.scrollTop).toBe(420);
  entry.remove();
  body.style.overflowY = "";
  html.style.overflowY = "";
});
