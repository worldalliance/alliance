import { type SetStateAction, useEffect, useState } from "react";
import { z } from "zod";
import type { Draft } from "./components/Composer";
import { type NewConversation, newConversation } from "./components/StartView";

export const newWorktreeDraft = "new";
export const askDraft = "ask";
export const worktreeDraft = (key: string) => `worktree:${key}`;

const draftsKey = "drafts";
const storedDrafts = z.record(z.string(), z.string());

/** Each message box's unsent text, kept across reloads, and each start form's agent choice and progress, keyed by conversation id or by the keys above. */
export function useDrafts() {
  const [drafts, setDrafts] = useState(() =>
    storedDrafts.parse(JSON.parse(localStorage.getItem(draftsKey) ?? "{}")),
  );
  const [starts, setStarts] = useState<Record<string, NewConversation>>({});

  useEffect(
    () => localStorage.setItem(draftsKey, JSON.stringify(drafts)),
    [drafts],
  );

  const draft = (key: string): Draft => ({
    text: drafts[key] ?? "",
    onChange: (update) =>
      setDrafts(({ [key]: old = "", ...rest }) => {
        const text = typeof update === "string" ? update : update(old);
        return text ? { ...rest, [key]: text } : rest;
      }),
  });

  /** Puts text before what the box at key already holds. */
  const addToDraft = (key: string, text: string) =>
    setDrafts(({ [key]: typed, ...rest }) => ({
      ...rest,
      [key]: typed ? `${text}\n${typed}` : text,
    }));

  const takeDraft = (key: string) =>
    setDrafts(({ [key]: _taken, ...rest }) => rest);

  const start = (key: string) => starts[key] ?? newConversation();

  const setStart = (key: string) => (update: SetStateAction<NewConversation>) =>
    setStarts((all) => {
      const old = all[key] ?? newConversation();
      return {
        ...all,
        [key]: typeof update === "function" ? update(old) : update,
      };
    });

  return { drafts, draft, addToDraft, takeDraft, start, setStart };
}
