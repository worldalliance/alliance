import { R } from "@alliance/common/result";
import { render } from "@testing-library/react";
import { describe, expect, it, mock } from "bun:test";
import { MemoryRouter, useSearchParams } from "react-router";

import {
  LinkedField,
  readLinkedSelection,
  selectionSearch,
  useLinkedSelection,
} from "./linkedSelection";

describe("linked selection", () => {
  it("reads back the field and range a link carries", () => {
    const search = selectionSearch({
      field: LinkedField.ShortDescription,
      from: 6,
      to: 8,
      text: "a b",
    });
    expect(readLinkedSelection(new URLSearchParams(search))).toEqual(
      R.success({
        field: LinkedField.ShortDescription,
        from: 6,
        to: 8,
        text: "a b",
      }),
    );
  });

  it("reads a URL without a selection as none", () => {
    expect(readLinkedSelection(new URLSearchParams("tab=details"))).toEqual(
      R.success(null),
    );
  });

  it("refuses a link without a usable range, field, or text", () => {
    for (const search of [
      "field=body",
      "field=body&from=&to=&text=",
      "field=body&from=x&to=2&text=ab",
      "field=body&from=-3&to=2&text=ab",
      "field=body&from=9&to=2&text=ab",
      "field=image&from=0&to=2&text=ab",
      "field=body&from=0&to=2",
    ]) {
      expect(readLinkedSelection(new URLSearchParams(search)).ok).toBe(false);
    }
  });
});

let search = "";
const onError = mock();
const Probe = ({ ready, field }: { ready: boolean; field: boolean }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  useLinkedSelection({ ready, searchParams, setSearchParams, onError });
  search = searchParams.toString();
  return field && <textarea id="body" defaultValue="Hello wrold, members" />;
};

const mount = (
  ready: boolean,
  {
    link = selectionSearch({
      field: LinkedField.Body,
      from: 6,
      to: 11,
      text: "wrold",
    }),
    field = true,
  } = {},
) =>
  render(
    <MemoryRouter initialEntries={[`/?tab=details&${link}`]}>
      <Probe ready={ready} field={field} />
    </MemoryRouter>,
  );

describe("useLinkedSelection", () => {
  it("selects the linked text once ready, then drops the link", () => {
    onError.mockClear();
    const view = mount(true);
    expect(onError).not.toHaveBeenCalled();
    const field = view.container.querySelector("textarea");
    expect(document.activeElement).toBe(field);
    expect([field?.selectionStart, field?.selectionEnd]).toEqual([6, 11]);
    expect(search).toBe("tab=details");
    view.unmount();
  });

  it("waits until ready, then selects", () => {
    onError.mockClear();
    const view = mount(false);
    const field = view.container.querySelector("textarea");
    expect(document.activeElement).not.toBe(field);
    expect(search).toContain("field=body");

    view.rerender(
      <MemoryRouter>
        <Probe ready field />
      </MemoryRouter>,
    );
    expect(onError).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(field);
    expect([field?.selectionStart, field?.selectionEnd]).toEqual([6, 11]);
    expect(search).toBe("tab=details");
    view.unmount();
  });

  it("names the field as the page labels it when its text changed", () => {
    onError.mockClear();
    const view = mount(true, { link: "field=body&from=0&to=5&text=wrold" });
    expect(onError).toHaveBeenCalledWith(
      'Couldn\'t select the flagged text: "Action page description" no longer reads "wrold" there, so it changed since the check.',
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(search).toBe("tab=details");
    view.unmount();
  });

  it.each([
    ["an unreadable range", { link: "field=body&from=9&to=2&text=wrold" }],
    ["a field the page lacks", { field: false }],
    [
      "a range past the field's text",
      { link: "field=body&from=6&to=40&text=wrold" },
    ],
  ])("reports a link with %s, then drops it", (_, options) => {
    onError.mockClear();
    const view = mount(true, options);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(search).toBe("tab=details");
    view.unmount();
  });

  const scrollTest = (field: {
    clientHeight: number;
    scrollHeight: number;
  }) => {
    const view = render(
      <div data-testid="pane" style={{ overflowY: "auto" }}>
        {/* happy-dom lays out no text, so textarea-caret puts the caret at the top border's width. */}
        <textarea
          id="body"
          defaultValue="Hello wrold, members"
          style={{ borderTopWidth: 120 }}
        />
      </div>,
    );
    const pane = view.getByTestId("pane");
    const textarea = view.container.querySelector("textarea");
    if (!textarea) throw new Error("no field");
    let scrollTop = 0;
    Object.defineProperties(textarea, {
      clientHeight: { value: field.clientHeight },
      scrollHeight: { value: field.scrollHeight },
      // Clamped as a browser clamps it.
      scrollTop: {
        get: () => scrollTop,
        set: (value: number) => {
          scrollTop = Math.min(
            Math.max(value, 0),
            field.scrollHeight - field.clientHeight,
          );
        },
      },
    });
    Object.defineProperties(pane, {
      scrollHeight: { value: 3000 },
      clientHeight: { value: 800 },
    });
    pane.getBoundingClientRect = () => DOMRect.fromRect({ y: 100 });
    textarea.getBoundingClientRect = () => DOMRect.fromRect({ y: 1500 });
    const scrollBy = mock();
    pane.scrollBy = scrollBy;
    const probe = mount(true, { field: false });
    probe.unmount();
    view.unmount();
    return { fieldScrollTop: scrollTop, scrollBy };
  };

  it("scrolls the pane holding a field that grows to fit to the selection", () => {
    const { fieldScrollTop, scrollBy } = scrollTest({
      clientHeight: 300,
      scrollHeight: 300,
    });
    expect(fieldScrollTop).toBe(0);
    expect(scrollBy).toHaveBeenCalledWith({ top: 1500 - 100 + 120 - 400 });
  });

  it("scrolls a field that scrolls inside itself to the selection, then the pane to it", () => {
    const { fieldScrollTop, scrollBy } = scrollTest({
      clientHeight: 40,
      scrollHeight: 200,
    });
    expect(fieldScrollTop).toBe(100);
    expect(scrollBy).toHaveBeenCalledWith({
      top: 1500 - 100 + 120 - 100 - 400,
    });
  });
});
