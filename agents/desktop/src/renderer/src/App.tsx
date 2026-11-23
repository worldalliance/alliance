import { useCallback, useEffect, useRef, useState } from "react";
import { R } from "../../../../../common/src/result";
import { type AgentKind, agentWords } from "../../shared/agent-kind";
import type {
  Conversation,
  CreatedWorktree,
  IpcResult,
} from "../../shared/ipc";
import { repositoryFolder } from "../../shared/repository";
import {
  isNewWorktreeKey,
  newWorktreeKey,
  type Worktree,
  WorktreeStatus,
} from "../../shared/worktree";
import { agent } from "./agent";
import { useAgentAccess } from "./agent-access";
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
import { RepositoryView } from "./components/RepositoryView";
import { type Listed, Sidebar } from "./components/Sidebar";
import { StartView } from "./components/StartView";
import { WorktreeView } from "./components/WorktreeView";
import { askDraft, newWorktreeDraft, useDrafts, worktreeDraft } from "./drafts";
import { focusIfLost } from "./focus";
import { notOpenPanel, Opened, type OpenState } from "./open-state";
import { useRepository } from "./repository";
import { sameView, type View, ViewKind } from "./view";
import { useWorktreeActions, useWorktrees } from "./worktrees";

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

const noRepository =
  "Alliance agent needs the Alliance repository to be ready first. See Alliance repository in the sidebar.";

const startProblem = (error: string) =>
  `Alliance agent couldn't start the conversation: ${error}`;

export function App() {
  const [conversations, setConversations] = useState<Listed>();
  const listedIds = useRef(new Set<string>());
  const [view, setView] = useState<View>({ kind: ViewKind.NewWorktree });
  const [chats, setChats] = useState<Record<string, Chat>>({});
  const [open, setOpen] = useState<Record<string, OpenState>>({});
  const { drafts, draft, addToDraft, takeDraft, start, setStart } = useDrafts();
  const [startedHere, setStartedHere] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const repository = useRepository();
  const worktrees = useWorktrees();
  const worktreeActions = useWorktreeActions();
  const checkout = repository.state && repositoryFolder(repository.state);

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
      unsubscribe();
      unsubscribeRemoved();
    };
  }, [updateChat, list]);

  const selected = view.kind === ViewKind.Conversation ? view.id : undefined;
  const selectedConversation =
    selected === undefined
      ? undefined
      : conversations?.all.find((c) => c.id === selected);
  const createdAs =
    view.kind === ViewKind.Worktree
      ? worktrees.state?.created[view.key]
      : undefined;
  // A creation's reply moves the view on; a window that missed it, as after a reload, shows the worktree the creation became.
  const shown: View = createdAs
    ? { kind: ViewKind.Worktree, key: createdAs }
    : view;
  const selectedWorktree =
    shown.kind === ViewKind.Worktree
      ? worktrees.state?.worktrees.find((t) => t.key === shown.key)
      : undefined;
  const startKey =
    view.kind === ViewKind.NewWorktree
      ? newWorktreeDraft
      : view.kind === ViewKind.Ask
        ? askDraft
        : shown.kind === ViewKind.Worktree
          ? worktreeDraft(shown.key)
          : undefined;
  const titles: Record<ViewKind, string> = {
    [ViewKind.Repository]: "Alliance repository",
    [ViewKind.NewWorktree]: "New worktree",
    [ViewKind.Ask]: "Ask without a worktree",
    [ViewKind.Worktree]: selectedWorktree?.title || "Worktree",
    [ViewKind.Conversation]: selectedConversation?.title || "Conversation",
  };
  const title = titles[view.kind];
  const selectedAgent =
    startKey === undefined
      ? selectedConversation?.agent
      : start(startKey).agent;
  const access = useAgentAccess(selectedAgent);
  const selectedSignedIn = selectedAgent && access.signedIn(selectedAgent);

  useEffect(() => {
    document.title = `${title} – Alliance agent`;
  }, [title]);

  // Moves to the new conversation only from the view it was started in.
  const moveFrom = (from: View, to: View) =>
    setView((current) => (sameView(current, from) ? to : current));

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

  const showStarted = (conversation: Conversation, text: string) => {
    const { id } = conversation;
    setChats((all) => ({ ...all, [id]: firstMessage(all[id], text) }));
    setConversations(
      (shown) =>
        shown && {
          ...shown,
          all: [conversation, ...shown.all.filter((c) => c.id !== id)],
        },
    );
    setStartedHere((all) => new Set(all).add(id));
    setOpen((all) => ({ ...all, [id]: Opened.Open }));
  };

  const startIn = async (input: {
    folder: string | undefined;
    text: string;
    agent: AgentKind;
    from: View;
  }): Promise<IpcResult<void>> => {
    if (!input.folder) return R.failure(noRepository);
    const started = await agent.start({
      folder: input.folder,
      firstMessage: input.text,
      agent: input.agent,
    });
    if (!started.ok) return R.failure(startProblem(started.error));
    showStarted(started.value, input.text);
    moveFrom(input.from, {
      kind: ViewKind.Conversation,
      id: started.value.id,
    });
    return R.success(undefined);
  };

  const created =
    (params: { key: string; request: string; agent: AgentKind }) =>
    async (reply: IpcResult<CreatedWorktree>) => {
      const from: View = { kind: ViewKind.Worktree, key: params.key };
      if (!reply.ok) {
        // A creation the main process listed shows its own failure.
        const now = await agent.worktreesState();
        if (now.ok && now.value.worktrees.some((t) => t.key === params.key))
          return;
        addToDraft(newWorktreeDraft, params.request);
        setStart(newWorktreeDraft)((s) => ({
          ...s,
          agent: params.agent,
          problem: reply.error,
        }));
        return moveFrom(from, { kind: ViewKind.NewWorktree });
      }
      const { key, conversation } = reply.value;
      if (conversation.ok) {
        showStarted(conversation.value, params.request);
        return moveFrom(from, {
          kind: ViewKind.Conversation,
          id: conversation.value.id,
        });
      }
      addToDraft(worktreeDraft(key), params.request);
      setStart(worktreeDraft(key))((s) => ({
        ...s,
        problem: startProblem(conversation.error),
      }));
      moveFrom(from, { kind: ViewKind.Worktree, key });
    };

  const createWorktree = (input: { text: string; agent: AgentKind }) => {
    const creationId = crypto.randomUUID();
    const key = newWorktreeKey(creationId);
    setView({ kind: ViewKind.Worktree, key });
    void agent
      .createWorktree({ creationId, request: input.text, agent: input.agent })
      .then(created({ key, request: input.text, agent: input.agent }));
  };

  const opened = useCallback(
    (id: string, resumed: Awaited<ReturnType<typeof agent.resume>>) => {
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

  const reopen = useCallback(
    async (id: string) => {
      setOpen((all) => ({ ...all, [id]: Opened.Opening }));
      opened(id, await agent.resume(id));
    },
    [opened],
  );

  // Stable while a reply streams, so the transcript's unchanged items skip re-rendering.
  const reopenSelected = useCallback(() => {
    if (selected !== undefined) void reopen(selected);
  }, [reopen, selected]);

  // A conversation opens once it is selected and its agent is signed in, so a signed-out agent's CLI never starts for it.
  const selectedUnopened =
    selected !== undefined && open[selected] === undefined;
  // An unset open state shows as opening, so this sets none before the resume answers; a repeated resume returns the same session.
  useEffect(() => {
    if (selectedSignedIn && selectedUnopened && selected !== undefined)
      void agent.resume(selected).then((resumed) => opened(selected, resumed));
  }, [selectedSignedIn, selectedUnopened, selected, opened]);

  const archive = async (worktree: Worktree): Promise<IpcResult<void>> => {
    const archived = await agent.archiveWorktree(worktree.key);
    if (!archived.ok) return archived;
    // Archiving closed its sessions, so each reopens when next selected; one still shown would reopen at once, so the view leaves it.
    const closed = new Set(
      (conversations?.all ?? [])
        .filter((c) => c.folder === worktree.folder)
        .map((c) => c.id),
    );
    setOpen((all) =>
      Object.fromEntries(Object.entries(all).filter(([id]) => !closed.has(id))),
    );
    setView((v) =>
      v.kind === ViewKind.Conversation && closed.has(v.id)
        ? { kind: ViewKind.Worktree, key: worktree.key }
        : v,
    );
    return archived;
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

  const moveTarget = (id: string) => {
    const moved = conversations?.all.find((c) => c.id === id);
    const found = worktrees.state?.worktrees.find(
      (t) => moved && t.folder === moved.folder,
    );
    const target: View = found
      ? { kind: ViewKind.Worktree, key: found.key }
      : { kind: ViewKind.Ask };
    return { moved, target, key: found ? worktreeDraft(found.key) : askDraft };
  };

  const moveToNew = (id: string) => {
    const { moved, target, key } = moveTarget(id);
    if (start(key).starting) return;
    const text = unsentText(id);
    takeDraft(id);
    addToDraft(key, text);
    setStart(key)((s) => ({
      ...s,
      agent: moved?.agent ?? s.agent,
      problem: undefined,
    }));
    setConversations(
      (shown) =>
        shown && { ...shown, all: shown.all.filter((c) => c.id !== id) },
    );
    setView(target);
  };

  const removedPanel = (id: string, kind: AgentKind) => {
    const note = `${agentWords[kind].product} stopped before reading your first message, so this conversation wasn't kept.`;
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
          aria-disabled={start(moveTarget(id).key).starting || undefined}
          onClick={() => moveToNew(id)}
        >
          Move your message to a new conversation
        </button>
      </div>
    );
  };

  const startView = (params: {
    key: string;
    heading?: string;
    hint: (agentName: string) => string;
    onStart: (input: {
      text: string;
      agent: AgentKind;
    }) => Promise<IpcResult<void>>;
  }) => {
    const state = start(params.key);
    return (
      <StartView
        key={params.key}
        heading={params.heading && <h1>{params.heading}</h1>}
        hint={params.hint}
        draft={draft(params.key)}
        state={state}
        signInPanel={access.signInPanel(state.agent)}
        onChange={setStart(params.key)}
        onStart={params.onStart}
      />
    );
  };

  const main = () => {
    switch (view.kind) {
      case ViewKind.Repository:
        return <RepositoryView shown={repository} />;
      case ViewKind.NewWorktree:
        return startView({
          key: newWorktreeDraft,
          heading: "New worktree",
          hint: (name) =>
            `Alliance agent sets up the worktree's own copy of the repository, which takes a minute or two, then sends ${name} this message.`,
          onStart: (input) => {
            if (!checkout) return Promise.resolve(R.failure(noRepository));
            createWorktree(input);
            return Promise.resolve(R.success(undefined));
          },
        });
      case ViewKind.Ask:
        return startView({
          key: askDraft,
          heading: "Ask without a worktree",
          hint: (name) =>
            `${name} works in the main copy of the repository${checkout ? `, ${checkout}` : ""}. New worktrees copy its database and local settings, so start a new worktree for changes.`,
          onStart: (input) =>
            startIn({ ...input, folder: checkout, from: view }),
        });
      case ViewKind.Worktree:
        return selectedWorktree ? (
          <WorktreeView
            key={selectedWorktree.key}
            worktree={selectedWorktree}
            newConversation={startView({
              key: worktreeDraft(selectedWorktree.key),
              hint: (name) => `${name} works in this worktree's folder.`,
              onStart: (input) =>
                startIn({
                  ...input,
                  folder: selectedWorktree.folder,
                  from: view,
                }),
            })}
            starting={start(worktreeDraft(selectedWorktree.key)).starting}
            action={worktreeActions(selectedWorktree.key)}
            onArchive={() => archive(selectedWorktree)}
            onRestore={() => agent.restoreWorktree(selectedWorktree.key)}
            onRetry={() => {
              if (selectedWorktree.state.status !== WorktreeStatus.CreateFailed)
                return;
              void agent.retryWorktree(selectedWorktree.key).then(
                created({
                  key: selectedWorktree.key,
                  request: selectedWorktree.state.request,
                  agent: selectedWorktree.state.agent,
                }),
              );
            }}
            onEditRequest={(failed) => {
              agent.dismissWorktree(selectedWorktree.key);
              addToDraft(newWorktreeDraft, failed.request);
              setStart(newWorktreeDraft)((s) => ({
                ...s,
                agent: failed.agent,
              }));
              setView({ kind: ViewKind.NewWorktree });
            }}
          />
        ) : (
          <p className="panel" role="status" tabIndex={-1} ref={focusIfLost}>
            {!createdAs && isNewWorktreeKey(view.key)
              ? "Setting up the worktree…"
              : "This worktree is no longer listed."}
          </p>
        );
      case ViewKind.Conversation:
        return conversationView(view.id);
      default:
        throw new Error(`unknown view: ${view satisfies never}`);
    }
  };

  const conversationView = (id: string) => {
    const conversationAgent = selectedConversation?.agent;
    if (!conversationAgent)
      return (
        <p className="panel" role="status">
          This conversation is no longer listed.
        </p>
      );
    const notOpen = removed.has(id)
      ? removedPanel(id, conversationAgent)
      : (access.signInPanel(conversationAgent) ??
        notOpenPanel({
          state: open[id] ?? Opened.Opening,
          onRetry: () => void reopen(id),
        }));
    const chat = chats[id] ?? emptyChat;
    if (notOpen && chat.items.length === 0)
      return (
        <>
          <h1 className="visually-hidden">{title}</h1>
          {notOpen}
        </>
      );
    return (
      <ChatView
        key={id}
        agentName={agentWords[conversationAgent].name}
        title={title}
        chat={chat}
        resumed={!startedHere.has(id)}
        draft={draft(id)}
        notOpen={notOpen}
        onSend={(text) => send({ sessionId: id, text })}
        onStop={() => {
          updateChat(id, stopRequested);
          agent.interrupt(id);
        }}
        onReopen={notOpen ? undefined : reopenSelected}
      />
    );
  };

  return (
    <div className="app">
      <Sidebar
        repository={repository}
        worktrees={worktrees}
        conversations={conversations}
        view={shown}
        onSelect={setView}
        onRetry={list}
      />
      <main className="main">{main()}</main>
    </div>
  );
}
