import type { Conversation } from "../../../shared/ipc";
import { folderName } from "../format";

export function Sidebar({
  conversations,
  selected,
  onSelect,
  onNew,
}: {
  /** Undefined while the list loads, a local read too short for a loading message. */
  conversations: Conversation[] | { problem: string } | undefined;
  selected: string | undefined;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <nav className="sidebar" aria-labelledby="conversations-heading">
      <h2 id="conversations-heading">Conversations</h2>
      <button
        type="button"
        className="new"
        aria-current={selected === undefined ? "page" : undefined}
        onClick={onNew}
      >
        Start a conversation
      </button>
      {conversations === undefined ? null : "problem" in conversations ? (
        <p className="error" role="alert">
          Alliance agent couldn't read your saved conversations:{" "}
          {conversations.problem}
        </p>
      ) : conversations.length === 0 ? (
        <p className="hint">No conversations yet.</p>
      ) : (
        <ul>
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <button
                type="button"
                aria-current={selected === conversation.id ? "page" : undefined}
                onClick={() => onSelect(conversation.id)}
              >
                <span className="title">{conversation.title}</span>
                <span className="meta">{folderName(conversation.folder)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
