import { useCallback, useEffect, useRef, useState } from "react";
import { R } from "../../../../../common/src/result";
import { type AgentKind, agentWords } from "../../shared/agent-kind";
import type { Conversation, CreatedTask, IpcResult } from "../../shared/ipc";
import { repositoryFolder } from "../../shared/repository";
import { isNewTaskKey, newTaskKey, TaskStatus } from "../../shared/task";
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
import { TaskView } from "./components/TaskView";
import { askDraft, newTaskDraft, taskDraft, useDrafts } from "./drafts";
import { focusIfLost } from "./focus";
import { useRepository } from "./repository";
import { useTasks } from "./tasks";
import { sameView, type View, ViewKind } from "./view";

enum Opened {
  Opening = "opening",
  Open = "open",
}

type OpenState = Opened | { problem: string };

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
  const [view, setView] = useState<View>({ kind: ViewKind.NewTask });
  const [chats, setChats] = useState<Record<string, Chat>>({});
  const [open, setOpen] = useState<Record<string, OpenState>>({});
  const { drafts, draft, addToDraft, takeDraft, start, setStart } = useDrafts();
  const [startedHere, setStartedHere] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const repository = useRepository();
  const tasks = useTasks();
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
    view.kind === ViewKind.Task ? tasks.state?.created[view.key] : undefined;
  // A creation's reply moves the view on; a window that missed it, as after a reload, shows the task the creation became.
  const shown: View = createdAs
    ? { kind: ViewKind.Task, key: createdAs }
    : view;
  const selectedTask =
    shown.kind === ViewKind.Task
      ? tasks.state?.tasks.find((t) => t.key === shown.key)
      : undefined;
  const startKey =
    view.kind === ViewKind.NewTask
      ? newTaskDraft
      : view.kind === ViewKind.Ask
        ? askDraft
        : shown.kind === ViewKind.Task
          ? taskDraft(shown.key)
          : undefined;
  const titles: Record<ViewKind, string> = {
    [ViewKind.Repository]: "Alliance repository",
    [ViewKind.NewTask]: "New task",
    [ViewKind.Ask]: "Ask without a task",
    [ViewKind.Task]: selectedTask?.title || "Task",
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
    async (reply: IpcResult<CreatedTask>) => {
      const from: View = { kind: ViewKind.Task, key: params.key };
      if (!reply.ok) {
        // A creation the main process listed shows its own failure.
        const now = await agent.tasksState();
        if (now.ok && now.value.tasks.some((t) => t.key === params.key)) return;
        addToDraft(newTaskDraft, params.request);
        setStart(newTaskDraft)((s) => ({
          ...s,
          agent: params.agent,
          problem: reply.error,
        }));
        return moveFrom(from, { kind: ViewKind.NewTask });
      }
      const { key, conversation } = reply.value;
      if (conversation.ok) {
        showStarted(conversation.value, params.request);
        return moveFrom(from, {
          kind: ViewKind.Conversation,
          id: conversation.value.id,
        });
      }
      addToDraft(taskDraft(key), params.request);
      setStart(taskDraft(key))((s) => ({
        ...s,
        problem: startProblem(conversation.error),
      }));
      moveFrom(from, { kind: ViewKind.Task, key });
    };

  const createTask = (input: { text: string; agent: AgentKind }) => {
    const creationId = crypto.randomUUID();
    const key = newTaskKey(creationId);
    setView({ kind: ViewKind.Task, key });
    void agent
      .createTask({ creationId, request: input.text, agent: input.agent })
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

  const moveTarget = (id: string) => {
    const moved = conversations?.all.find((c) => c.id === id);
    const task = tasks.state?.tasks.find(
      (t) => moved && t.folder === moved.folder,
    );
    const target: View = task
      ? { kind: ViewKind.Task, key: task.key }
      : { kind: ViewKind.Ask };
    return { moved, target, key: task ? taskDraft(task.key) : askDraft };
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
      case ViewKind.NewTask:
        return startView({
          key: newTaskDraft,
          heading: "New task",
          hint: (name) =>
            `Alliance agent sets up the task's own copy of the repository, which takes a minute or two, then sends ${name} this message.`,
          onStart: (input) => {
            if (!checkout) return Promise.resolve(R.failure(noRepository));
            createTask(input);
            return Promise.resolve(R.success(undefined));
          },
        });
      case ViewKind.Ask:
        return startView({
          key: askDraft,
          heading: "Ask without a task",
          hint: (name) =>
            `${name} works in the main copy of the repository${checkout ? `, ${checkout}` : ""}. New tasks copy its database and local settings, so start a new task for changes.`,
          onStart: (input) =>
            startIn({ ...input, folder: checkout, from: view }),
        });
      case ViewKind.Task:
        return selectedTask ? (
          <TaskView
            key={selectedTask.key}
            task={selectedTask}
            newConversation={startView({
              key: taskDraft(selectedTask.key),
              hint: (name) => `${name} works in this task's folder.`,
              onStart: (input) =>
                startIn({ ...input, folder: selectedTask.folder, from: view }),
            })}
            onRetry={() => {
              if (selectedTask.state.status !== TaskStatus.CreateFailed) return;
              void agent.retryTask(selectedTask.key).then(
                created({
                  key: selectedTask.key,
                  request: selectedTask.state.request,
                  agent: selectedTask.state.agent,
                }),
              );
            }}
            onEditRequest={(failed) => {
              agent.dismissTask(selectedTask.key);
              addToDraft(newTaskDraft, failed.request);
              setStart(newTaskDraft)((s) => ({ ...s, agent: failed.agent }));
              setView({ kind: ViewKind.NewTask });
            }}
          />
        ) : (
          <p className="panel" role="status" tabIndex={-1} ref={focusIfLost}>
            {!createdAs && isNewTaskKey(view.key)
              ? "Setting up the task…"
              : "This task is no longer listed."}
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
      : (access.signInPanel(conversationAgent) ?? notOpenPanel(id));
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
        tasks={tasks}
        conversations={conversations}
        view={shown}
        onSelect={setView}
        onRetry={list}
      />
      <main className="main">{main()}</main>
    </div>
  );
}
