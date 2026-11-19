import { memo, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import {
  type Chat,
  type ChatItem,
  ItemKind,
  offersReopen,
  turnStatus,
} from "../chat-state";
import { Composer, type Draft } from "./Composer";
import { ToolCard } from "./ToolCard";

const nearEndPx = 80;

function ErrorItem({
  agentName,
  message,
  needsResume,
  refused,
  onReopen,
}: {
  agentName: string;
  message: string;
  needsResume: boolean;
  refused: boolean;
  onReopen: (() => void) | undefined;
}) {
  return (
    <div className="error">
      <p>
        {refused
          ? `${agentName} didn't get your message.`
          : `${agentName} couldn't finish this reply.`}
        {!needsResume && " Try sending your message again."}
        {needsResume &&
          onReopen &&
          (refused
            ? " Reopen the conversation, then send it again."
            : " Reopen the conversation to continue.")}
      </p>
      <details>
        <summary>Details</summary>
        <pre>{message}</pre>
      </details>
      {needsResume && onReopen && (
        <button type="button" onClick={onReopen}>
          Reopen conversation
        </button>
      )}
    </div>
  );
}

const Item = memo(function Item({
  agentName,
  item,
  onReopen,
}: {
  agentName: string;
  item: ChatItem;
  /** Undefined while the conversation can't be reopened from its transcript, or once a reopen followed the item. */
  onReopen: (() => void) | undefined;
}) {
  switch (item.kind) {
    case ItemKind.User:
      return (
        <>
          <span className="visually-hidden">You: </span>
          <div className="user">{item.text}</div>
        </>
      );
    case ItemKind.Assistant:
      return (
        <>
          <span className="visually-hidden">{agentName}: </span>
          <div className="assistant" aria-busy={item.streaming || undefined}>
            {item.text}
          </div>
        </>
      );
    case ItemKind.Tool:
      return <ToolCard item={item} />;
    case ItemKind.Error:
      return (
        <ErrorItem
          agentName={agentName}
          message={item.message}
          needsResume={item.needsResume}
          refused={item.refused}
          onReopen={onReopen}
        />
      );
    case ItemKind.Stopped:
      return <p className="stopped">You stopped this reply.</p>;
    default:
      throw new Error(`unknown item kind: ${item satisfies never}`);
  }
});

export function ChatView({
  agentName,
  title,
  chat,
  resumed,
  draft,
  notOpen,
  onSend,
  onStop,
  onReopen,
}: {
  agentName: string;
  title: string;
  chat: Chat;
  /** Opened without this window having started it, so the view doesn't have its earlier messages. */
  resumed: boolean;
  draft: Draft;
  /** Shown in place of the turn status and message box while the conversation opens or fails to. Jump to latest focuses its first button or element with a tabindex. */
  notOpen: ReactNode;
  onSend: (text: string) => Promise<boolean>;
  onStop: () => void;
  /** Undefined while notOpen is shown. */
  onReopen: (() => void) | undefined;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const nearEnd = useRef(true);
  const followOwnMessage = useRef(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const notOpenPanel = useRef<HTMLDivElement>(null);
  const [unseen, setUnseen] = useState(false);

  const scrollToEnd = () => {
    const element = scroller.current;
    if (element) element.scrollTop = element.scrollHeight;
    nearEnd.current = true;
    setUnseen(false);
  };

  useLayoutEffect(() => {
    if (nearEnd.current || followOwnMessage.current) scrollToEnd();
    else setUnseen(true);
    followOwnMessage.current = false;
  }, [chat.items]);

  return (
    <>
      <h1 className="visually-hidden">{title}</h1>
      <div
        className="transcript"
        ref={scroller}
        onScroll={(event) => {
          const element = event.currentTarget;
          nearEnd.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            nearEndPx;
          if (nearEnd.current) setUnseen(false);
        }}
      >
        {resumed && (
          <p className="note">
            Earlier messages in this conversation aren't shown here yet.{" "}
            {agentName} still remembers them.
          </p>
        )}
        <ol className="items">
          {chat.items.map((item) => (
            <li key={item.key}>
              <Item
                agentName={agentName}
                item={item}
                onReopen={offersReopen(chat, item) ? onReopen : undefined}
              />
            </li>
          ))}
        </ol>
        {unseen && (
          <button
            type="button"
            className="jump"
            onClick={() => {
              scrollToEnd();
              (
                box.current ??
                notOpenPanel.current?.querySelector<HTMLElement>(
                  "button, [tabindex]",
                )
              )?.focus();
            }}
          >
            Jump to latest
          </button>
        )}
      </div>
      {notOpen ? (
        <div className="not-open" ref={notOpenPanel}>
          {notOpen}
        </div>
      ) : (
        <>
          <p className="turn-status" role="status">
            {turnStatus(chat, agentName)}
          </p>
          <Composer
            agentName={agentName}
            draft={draft}
            boxRef={box}
            turn={chat.turn}
            onSend={(text) => {
              followOwnMessage.current = true;
              return onSend(text);
            }}
            onStop={onStop}
          />
        </>
      )}
    </>
  );
}
