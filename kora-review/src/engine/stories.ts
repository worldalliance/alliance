import type { StoriesCtx } from "./context.js";
import type { Transcript } from "./types.js";

type Story = { key: "child" | "scenario"; title: string; text: string };

// The header's age chip opens a menu of the stories behind the conversation; picking one shows both, at that one.
export function createStories(ctx: StoriesCtx) {
  const { doc, h, icon, on, rootEl } = ctx;

  let open: { button: HTMLElement; menu: HTMLElement } | null = null;

  const paragraphs = (text: string) =>
    text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => h("p", {}, p));

  function stories(t: Transcript): Story[] {
    const out: Story[] = [];
    if (t.context.background)
      out.push({
        key: "child",
        title: "The child's story",
        text: t.context.background,
      });
    if (t.context.scenario)
      out.push({
        key: "scenario",
        title: "The scenario",
        text: t.context.scenario,
      });
    return out;
  }

  /** The age chip: a plain label, or a menu button when the transcript has a story to show. */
  function ageMenu(t: Transcript, label: string): HTMLElement {
    const all = stories(t);
    if (!all.length) return h("span", { class: "cage" }, label);
    const items = all.map((s) =>
      h(
        "button",
        {
          type: "button",
          role: "menuitem",
          tabindex: "-1",
          class: "story-item",
          onclick: () => {
            closeMenu(false);
            showStories(all, s.key, button);
          },
        },
        s.title,
      ),
    );
    const menu = h(
      "div",
      { class: "story-menu", role: "menu", hidden: true },
      items,
    );
    const button = h(
      "button",
      {
        type: "button",
        class: "cage cage-btn",
        "aria-haspopup": "menu",
        "aria-expanded": "false",
        onclick: () => (open ? closeMenu(true) : openMenu(button, menu, 0)),
        onkeydown: (e: KeyboardEvent) => {
          if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
          e.preventDefault();
          openMenu(button, menu, e.key === "ArrowDown" ? 0 : items.length - 1);
        },
      },
      label,
      icon("chevronDown"),
    );
    on(menu, "keydown", (e) => {
      const i = items.indexOf(e.target as HTMLButtonElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        items[
          (i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length
        ]?.focus();
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        items[e.key === "Home" ? 0 : items.length - 1]?.focus();
      } else if (e.key === "Escape" || e.key === "Tab") {
        if (e.key === "Escape") e.preventDefault();
        closeMenu(e.key === "Escape");
      }
    });
    return h("span", { class: "story-wrap" }, button, menu);
  }
  function openMenu(button: HTMLElement, menu: HTMLElement, focus: number) {
    closeMenu(false);
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    open = { button, menu };
    menu.querySelectorAll<HTMLElement>("[role=menuitem]")[focus]?.focus();
  }
  function closeMenu(refocus: boolean) {
    if (!open) return;
    const { button, menu } = open;
    open = null;
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (refocus) button.focus();
  }
  on(doc, "pointerdown", (e) => {
    if (open && !open.button.parentElement?.contains(e.target as Node))
      closeMenu(false);
  });

  function showStories(all: Story[], at: Story["key"], returnTo: HTMLElement) {
    const close = h(
      "button",
      { type: "button", class: "iconbtn story-x", "aria-label": "Close" },
      icon("x"),
    );
    const sections = all.map((s) =>
      h(
        "section",
        { class: "story", "aria-labelledby": "story-" + s.key },
        h("h2", { id: "story-" + s.key, tabindex: "-1" }, s.title),
        paragraphs(s.text),
      ),
    );
    const dlg = h(
      "dialog",
      { class: "story-dlg", "aria-label": "About this conversation" },
      h("div", { class: "story-top" }, close),
      h("div", { class: "story-body" }, sections),
    );
    const done = () => {
      dlg.remove();
      returnTo.focus();
    };
    on(close, "click", () => dlg.close());
    on(dlg, "close", done);
    // A click on the backdrop lands on the dialog element itself.
    on(dlg, "click", (e) => {
      if (e.target === dlg) dlg.close();
    });
    rootEl.append(dlg);
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
    const heading =
      sections[all.findIndex((s) => s.key === at)]?.querySelector("h2");
    heading?.scrollIntoView?.({ block: "start" });
    heading?.focus({ preventScroll: true });
  }

  return { ageMenu };
}
