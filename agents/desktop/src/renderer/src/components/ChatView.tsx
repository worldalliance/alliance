import { memo, useLayoutEffect, useRef, useState } from "react";
import { type Chat, type ChatItem, ItemKind, turnStatus } from "../chat-state";
import { Composer, type Draft } from "./Composer";
import { ToolCard } from "./ToolCard";

const nearEndPx = 80;

function ErrorItem({
  message,
  needsResume,
  refused,
  onReopen,
}: {
  message: string;
  needsResume: boolean;
  refused: boolean;
  onReopen: (() => void) | undefined;
}) {
  return (
    <div className="error">
      <p>
        {refused
          ? "Claude didn't get your message."
          : "Claude couldn't finish this reply."}
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
  item,
  onReopen,
}: {
  item: ChatItem;
  /** Undefined once a reopen followed the item. */
  onReopen: (() => void) | undefined;
}) {
  switch (item.kind) {
    case ItemKind.User:
      return <div className="user">{item.text}</div>;
    case ItemKind.Assistant:
      return (
        <div className="assistant" aria-busy={item.streaming || undefined}>
          {item.text}
        </div>
      );
    case ItemKind.Tool:
      return <ToolCard item={item} />;
    case ItemKind.Error:
      return (
        <ErrorItem
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
  title,
  chat,
  resumed,
  draft,
  onSend,
  onStop,
  onReopen,
}: {
  title: string;
  chat: Chat;
  /** Opened from an earlier run, whose messages this view doesn't have. */
  resumed: boolean;
  draft: Draft;
  onSend: (text: string) => Promise<boolean>;
  onStop: () => void;
  onReopen: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const nearEnd = useRef(true);
  const followOwnMessage = useRef(false);
  const box = useRef<HTMLTextAreaElement>(null);
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
            Earlier messages in this conversation aren't shown here yet. Claude
            still remembers them.
          </p>
        )}
        <ol className="items">
          {chat.items.map((item) => (
            <li key={item.key}>
              <Item
                item={item}
                onReopen={item.key >= chat.reopenedAt ? onReopen : undefined}
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
              box.current?.focus();
            }}
          >
            Jump to latest
          </button>
        )}
      </div>
      <p className="turn-status" role="status">
        {turnStatus(chat)}
      </p>
      <Composer
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
  );
}
