import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { R } from "../../../../../common/src/result";
import type { Conversation, IpcResult } from "../../shared/ipc";
import { agent } from "./agent";
import {
  applyEvent,
  type Chat,
  emptyChat,
  firstMessage,
  reopened,
  resumedMidTurn,
  sendFailed,
  sendMessage,
  stopRequested,
} from "./chat-state";
import { ChatView } from "./components/ChatView";
import type { Draft } from "./components/Composer";
import { Sidebar } from "./components/Sidebar";
import {
  ClaudeAccess,
  type ClaudeState,
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
const storedDrafts = z.record(z.string(), z.string());

const claudeState = (signedIn: IpcResult<boolean>): ClaudeState =>
  signedIn.ok
    ? {
        access: signedIn.value ? ClaudeAccess.SignedIn : ClaudeAccess.SignedOut,
      }
    : { access: ClaudeAccess.Unavailable, problem: signedIn.error };

const signInTitle: Record<ClaudeAccess, string | undefined> = {
  [ClaudeAccess.Checking]: "Checking your Claude sign-in",
  [ClaudeAccess.SignedIn]: undefined,
  [ClaudeAccess.SignedOut]: "Sign in to Claude",
  [ClaudeAccess.SigningIn]: "Sign in to Claude",
  [ClaudeAccess.Unavailable]: "Claude isn't available",
};

export function App() {
  const [claude, setClaude] = useState<ClaudeState>({
    access: ClaudeAccess.Checking,
  });
  const [conversations, setConversations] = useState<
    Conversation[] | { problem: string } | undefined
  >();
  const [selected, setSelected] = useState<string>();
  const [chats, setChats] = useState<Record<string, Chat>>({});
  const [open, setOpen] = useState<Record<string, OpenState>>({});
  // sessionStorage survives a reload of the window, which drops the rest of the renderer's state.
  const [drafts, setDrafts] = useState(() =>
    storedDrafts.parse(JSON.parse(sessionStorage.getItem(draftsKey) ?? "{}")),
  );
  const [newConversation, setNewConversation] = useState<NewConversation>({
    starting: false,
  });
  const [startedHere, setStartedHere] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const signInCancelled = useRef(false);

  useEffect(
    () => sessionStorage.setItem(draftsKey, JSON.stringify(drafts)),
    [drafts],
  );

  const updateChat = useCallback(
    (id: string, change: (chat: Chat) => Chat) =>
      setChats((all) => ({ ...all, [id]: change(all[id] ?? emptyChat) })),
    [],
  );

  useEffect(() => {
    let current = true;
    void agent.claudeSignedIn().then((signedIn) => {
      if (current) setClaude(claudeState(signedIn));
    });
    void agent.listConversations().then((listed) => {
      if (current)
        setConversations(listed.ok ? listed.value : { problem: listed.error });
    });
    const unsubscribe = agent.onEvent(({ sessionId, event }) =>
      updateChat(sessionId, (chat) => applyEvent(chat, event)),
    );
    return () => {
      current = false;
      unsubscribe();
    };
  }, [updateChat]);

  const checkClaude = async () => {
    setClaude({ access: ClaudeAccess.Checking });
    setClaude(claudeState(await agent.claudeSignedIn()));
  };

  const title =
    selected === undefined
      ? "New conversation"
      : (Array.isArray(conversations) &&
          conversations.find((c) => c.id === selected)?.title) ||
        "Conversation";

  useEffect(() => {
    document.title = `${signInTitle[claude.access] ?? title} – Alliance agent`;
  }, [claude.access, title]);

  const signIn = async () => {
    signInCancelled.current = false;
    setClaude({ access: ClaudeAccess.SigningIn, cancelling: false });
    const signedIn = await agent.signIn();
    if (signedIn.ok) {
      setClaude({ access: ClaudeAccess.Checking });
      const checked = claudeState(await agent.claudeSignedIn());
      return setClaude(
        checked.access === ClaudeAccess.SignedOut
          ? {
              ...checked,
              problem: "Claude Code still reports you're signed out.",
            }
          : checked,
      );
    }
    if (!signInCancelled.current) setClaude({ access: ClaudeAccess.Checking });
    const checked = claudeState(await agent.claudeSignedIn());
    if (signInCancelled.current || checked.access !== ClaudeAccess.SignedOut)
      return setClaude(checked);
    setClaude({ ...checked, problem: signedIn.error });
  };

  const draft = (key: string): Draft => ({
    text: drafts[key] ?? "",
    onChange: (update) =>
      setDrafts((all) => ({
        ...all,
        [key]: typeof update === "string" ? update : update(all[key] ?? ""),
      })),
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
    const started = await agent.start({ folder, firstMessage: text });
    if (!started.ok) return started;
    const { id } = started.value;
    setChats((all) => ({ ...all, [id]: firstMessage(all[id], text) }));
    setConversations((all) =>
      Array.isArray(all) ? [started.value, ...all] : all,
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

  const main = () => {
    if (claude.access !== ClaudeAccess.SignedIn)
      return (
        <SignInPanel
          state={claude}
          onSignIn={() => void signIn()}
          onCancel={() => {
            signInCancelled.current = true;
            setClaude({ access: ClaudeAccess.SigningIn, cancelling: true });
            agent.cancelSignIn();
          }}
          onCheckAgain={() => void checkClaude()}
        />
      );
    if (selected === undefined)
      return (
        conversations !== undefined && (
          <StartView
            key="new"
            defaultFolder={
              Array.isArray(conversations)
                ? conversations[0]?.folder
                : undefined
            }
            draft={draft(newConversationDraft)}
            state={newConversation}
            onChange={setNewConversation}
            onStart={start}
          />
        )
      );
    const state = open[selected];
    if (typeof state === "object")
      return (
        <div className="panel">
          <p role="alert">
            Alliance agent couldn't open this conversation: {state.problem}
          </p>
          <button
            type="button"
            ref={focusIfLost}
            onClick={() => void reopen(selected)}
          >
            Try again
          </button>
        </div>
      );
    const opened = state ?? Opened.Opening;
    switch (opened) {
      case Opened.Opening:
        return (
          <p className="panel" role="status" tabIndex={-1} ref={focusIfLost}>
            Opening the conversation…
          </p>
        );
      case Opened.Open:
        return (
          <ChatView
            key={selected}
            title={title}
            chat={chats[selected] ?? emptyChat}
            resumed={!startedHere.has(selected)}
            draft={draft(selected)}
            onSend={(text) => send({ sessionId: selected, text })}
            onStop={() => {
              updateChat(selected, stopRequested);
              agent.interrupt(selected);
            }}
            onReopen={reopenSelected}
          />
        );
      default:
        throw new Error(`unknown open state: ${opened satisfies never}`);
    }
  };

  return (
    <div className="app">
      {claude.access === ClaudeAccess.SignedIn && (
        <Sidebar
          conversations={conversations}
          selected={selected}
          onSelect={select}
          onNew={() => setSelected(undefined)}
        />
      )}
      <main className="main">{main()}</main>
    </div>
  );
}
