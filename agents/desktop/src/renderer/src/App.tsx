import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { R } from "../../../../../common/src/result";
import { AgentKind } from "../../shared/agent-kind";
import type { Conversation, IpcResult } from "../../shared/ipc";
import { agent } from "./agent";
import {
  applyEvent,
  type Chat,
  emptyChat,
  firstMessage,
  ItemKind,
  reopened,
  resumedMidTurn,
  sendFailed,
  sendMessage,
  stopRequested,
} from "./chat-state";
import { ChatView } from "./components/ChatView";
import type { Draft } from "./components/Composer";
import { type Listed, Sidebar } from "./components/Sidebar";
import {
  ClaudeAccess,
  type ClaudeState,
  signInHeading,
  SignInPanel,
} from "./components/SignInPanel";
import { type NewConversation, StartView } from "./components/StartView";
import { focusIfLost } from "./focus";

enum Opened {
  Opening = "opening",
  Open = "open",
}

type OpenState = Opened | { problem: string };

const newConversationDraft = "new";

const draftsKey = "drafts";
const chosenFolderKey = "chosen-folder";
const storedDrafts = z.record(z.string(), z.string());

const claudeState = (
  signedIn: IpcResult<boolean>,
): Extract<
  ClaudeState,
  {
    access:
      | ClaudeAccess.SignedIn
      | ClaudeAccess.SignedOut
      | ClaudeAccess.Unavailable;
  }
> =>
  signedIn.ok
    ? {
        access: signedIn.value ? ClaudeAccess.SignedIn : ClaudeAccess.SignedOut,
      }
    : { access: ClaudeAccess.Unavailable, problem: signedIn.error };

// A read can finish after a start this window made, or miss one the window's previous load made, so it adds to the list rather than replacing it.
const withListed = (
  shown: Listed | undefined,
  listed: IpcResult<Conversation[]>,
): Listed => {
  const all = shown?.all ?? [];
  if (!listed.ok) return { all, problem: listed.error };
  const read = new Set(listed.value.map((c) => c.id));
  return {
    all: [...all.filter((c) => !read.has(c.id)), ...listed.value].toSorted(
      (a, b) => b.startedAt.localeCompare(a.startedAt),
    ),
  };
};

export function App() {
  const [claude, setClaude] = useState<ClaudeState>({
    access: ClaudeAccess.Checking,
  });
  const [conversations, setConversations] = useState<Listed>();
  const listedIds = useRef(new Set<string>());
  const [selected, setSelected] = useState<string>();
  const [chats, setChats] = useState<Record<string, Chat>>({});
  const [open, setOpen] = useState<Record<string, OpenState>>({});
  const [drafts, setDrafts] = useState(() =>
    storedDrafts.parse(JSON.parse(localStorage.getItem(draftsKey) ?? "{}")),
  );
  const [newConversation, setNewConversation] = useState<NewConversation>(
    () => ({
      chosen: localStorage.getItem(chosenFolderKey) ?? undefined,
      starting: false,
    }),
  );
  const [startedHere, setStartedHere] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const signInCancelled = useRef(false);
  const signingIn = useRef(false);

  useEffect(
    () => localStorage.setItem(draftsKey, JSON.stringify(drafts)),
    [drafts],
  );

  useEffect(() => {
    if (newConversation.chosen !== undefined)
      localStorage.setItem(chosenFolderKey, newConversation.chosen);
  }, [newConversation.chosen]);

  const updateChat = useCallback(
    (id: string, change: (chat: Chat) => Chat) =>
      setChats((all) => ({ ...all, [id]: change(all[id] ?? emptyChat) })),
    [],
  );

  useEffect(() => {
    for (const { id } of conversations?.all ?? []) listedIds.current.add(id);
  }, [conversations]);

  const list = useCallback(
    () =>
      agent
        .listConversations()
        .then((listed) => setConversations((all) => withListed(all, listed))),
    [],
  );

  useEffect(() => {
    let current = true;
    void agent.signedIn(AgentKind.Claude).then((signedIn) => {
      if (current) setClaude(claudeState(signedIn));
    });
    void list();
    const unsubscribe = agent.onEvent(({ sessionId, event }) => {
      updateChat(sessionId, (chat) => applyEvent(chat, event));
      // A start still running when the window reloaded saves its conversation before the first event, the reloaded window's only word of it.
      if (listedIds.current.has(sessionId)) return;
      listedIds.current.add(sessionId);
      void list();
    });
    const unsubscribeRemoved = agent.onConversationRemoved((id) =>
      setRemoved((all) => new Set(all).add(id)),
    );
    return () => {
      current = false;
      unsubscribe();
      unsubscribeRemoved();
    };
  }, [updateChat, list]);

  const checkClaude = async () => {
    setClaude({ access: ClaudeAccess.Checking });
    setClaude(claudeState(await agent.signedIn(AgentKind.Claude)));
  };

  const title =
    selected === undefined
      ? "New conversation"
      : conversations?.all.find((c) => c.id === selected)?.title ||
        "Conversation";

  useEffect(() => {
    document.title = `${claude.access === ClaudeAccess.SignedIn ? title : signInHeading[claude.access]} – Alliance agent`;
  }, [claude.access, title]);

  const signIn = async () => {
    signInCancelled.current = false;
    setClaude({ access: ClaudeAccess.SigningIn, cancelling: false });
    signingIn.current = true;
    const signedIn = await agent.signIn(AgentKind.Claude);
    signingIn.current = false;
    if (!signInCancelled.current) setClaude({ access: ClaudeAccess.Checking });
    const checked = claudeState(await agent.signedIn(AgentKind.Claude));
    if (signInCancelled.current) return setClaude(checked);
    switch (checked.access) {
      case ClaudeAccess.SignedIn:
        return setClaude(checked);
      case ClaudeAccess.Unavailable:
        return setClaude(
          signedIn.ok || signedIn.error === checked.problem
            ? checked
            : { ...checked, problem: `${signedIn.error}\n${checked.problem}` },
        );
      case ClaudeAccess.SignedOut:
        return setClaude({
          access: ClaudeAccess.SignedOut,
          problem: signedIn.ok
            ? "Claude Code still reports you're signed out."
            : signedIn.error,
        });
      default:
        throw new Error(`unknown access: ${checked satisfies never}`);
    }
  };

  const draft = (key: string): Draft => ({
    text: drafts[key] ?? "",
    onChange: (update) =>
      setDrafts(({ [key]: old = "", ...rest }) => {
        const text = typeof update === "string" ? update : update(old);
        return text ? { ...rest, [key]: text } : rest;
      }),
  });

  const send = async (input: {
    sessionId: string;
    text: string;
  }): Promise<boolean> => {
    const { sessionId, text } = input;
    updateChat(sessionId, (chat) => sendMessage(chat, text));
    const sent = await agent.send(input);
    if (!sent.ok) updateChat(sessionId, (chat) => sendFailed(chat, sent.error));
    return sent.ok;
  };

  const start = async (input: {
    folder: string;
    text: string;
  }): Promise<IpcResult<void>> => {
    const { folder, text } = input;
    const started = await agent.start({
      folder,
      firstMessage: text,
      agent: AgentKind.Claude,
    });
    if (!started.ok) return started;
    const { id } = started.value;
    setChats((all) => ({ ...all, [id]: firstMessage(all[id], text) }));
    setConversations(
      (shown) =>
        shown && {
          ...shown,
          all: [started.value, ...shown.all.filter((c) => c.id !== id)],
        },
    );
    setStartedHere((all) => new Set(all).add(id));
    setOpen((all) => ({ ...all, [id]: Opened.Open }));
    setSelected((current) => current ?? id);
    return R.success(undefined);
  };

  const reopen = useCallback(
    async (id: string) => {
      setOpen((all) => ({ ...all, [id]: Opened.Opening }));
      const resumed = await agent.resume(id);
      setOpen((all) => ({
        ...all,
        [id]: resumed.ok ? Opened.Open : { problem: resumed.error },
      }));
      if (!resumed.ok) return;
      updateChat(id, reopened);
      if (resumed.value.turnRunning) updateChat(id, resumedMidTurn);
    },
    [updateChat],
  );

  // Stable while a reply streams, so the transcript's unchanged items skip re-rendering.
  const reopenSelected = useCallback(() => {
    if (selected !== undefined) void reopen(selected);
  }, [reopen, selected]);

  const select = (id: string) => {
    setSelected(id);
    if (open[id] === undefined) void reopen(id);
  };

  const notOpenPanel = (id: string) => {
    const state = open[id] ?? Opened.Opening;
    if (typeof state === "object")
      return (
        <div className="panel">
          <p className="error" role="alert">
            Alliance agent couldn't open this conversation: {state.problem}
          </p>
          <button
            type="button"
            ref={focusIfLost}
            onClick={() => void reopen(id)}
          >
            Try again
          </button>
        </div>
      );
    switch (state) {
      case Opened.Opening:
        return (
          <p className="panel" role="status" tabIndex={-1} ref={focusIfLost}>
            Opening the conversation…
          </p>
        );
      case Opened.Open:
        return undefined;
      default:
        throw new Error(`unknown open state: ${state satisfies never}`);
    }
  };

  const unsentText = (id: string) =>
    [
      ...(chats[id]?.items ?? []).flatMap((item) =>
        item.kind === ItemKind.User ? [item.text] : [],
      ),
      drafts[id] ?? "",
    ]
      .filter(Boolean)
      .join("\n");

  const moveToNew = (id: string) => {
    if (newConversation.starting) return;
    const text = unsentText(id);
    setDrafts(({ [id]: _moved, [newConversationDraft]: typed, ...rest }) => ({
      ...rest,
      [newConversationDraft]: typed ? `${text}\n${typed}` : text,
    }));
    const folder = conversations?.all.find((c) => c.id === id)?.folder;
    setNewConversation((state) => ({
      ...state,
      chosen: folder ?? state.chosen,
      problem: undefined,
    }));
    setConversations(
      (shown) =>
        shown && { ...shown, all: shown.all.filter((c) => c.id !== id) },
    );
    setSelected(undefined);
  };

  const removedPanel = (id: string) => {
    const note =
      "Claude Code stopped before reading your first message, so this conversation wasn't kept.";
    if (!unsentText(id))
      return (
        <p className="panel" role="status" tabIndex={-1} ref={focusIfLost}>
          {note} Start a new conversation to send it again.
        </p>
      );
    return (
      <div className="panel">
        <p role="status">{note}</p>
        <button
          type="button"
          ref={focusIfLost}
          aria-disabled={newConversation.starting || undefined}
          onClick={() => moveToNew(id)}
        >
          Move your message to a new conversation
        </button>
      </div>
    );
  };

  const main = () => {
    if (claude.access !== ClaudeAccess.SignedIn)
      return (
        <SignInPanel
          state={claude}
          onSignIn={() => void signIn()}
          onCancel={() => {
            // Once the sign-in's reply arrives, a Cancel has nothing to stop and would hide why it failed.
            if (!signingIn.current) return;
            signInCancelled.current = true;
            setClaude({ access: ClaudeAccess.SigningIn, cancelling: true });
            agent.cancelSignIn(AgentKind.Claude);
          }}
          onCheckAgain={() => void checkClaude()}
        />
      );
    if (selected === undefined)
      return (
        conversations !== undefined && (
          <StartView
            key="new"
            defaultFolder={conversations.all[0]?.folder}
            draft={draft(newConversationDraft)}
            state={newConversation}
            onChange={setNewConversation}
            onStart={start}
          />
        )
      );
    const notOpen = removed.has(selected)
      ? removedPanel(selected)
      : notOpenPanel(selected);
    const chat = chats[selected] ?? emptyChat;
    if (notOpen && chat.items.length === 0)
      return (
        <>
          <h1 className="visually-hidden">{title}</h1>
          {notOpen}
        </>
      );
    return (
      <ChatView
        key={selected}
        title={title}
        chat={chat}
        resumed={!startedHere.has(selected)}
        draft={draft(selected)}
        notOpen={notOpen}
        onSend={(text) => send({ sessionId: selected, text })}
        onStop={() => {
          updateChat(selected, stopRequested);
          agent.interrupt(selected);
        }}
        onReopen={notOpen ? undefined : reopenSelected}
      />
    );
  };

  return (
    <div className="app">
      {claude.access === ClaudeAccess.SignedIn && (
        <Sidebar
          conversations={conversations}
          selected={selected}
          onSelect={select}
          onNew={() => setSelected(undefined)}
          onRetry={list}
        />
      )}
      <main className="main">{main()}</main>
    </div>
  );
}
