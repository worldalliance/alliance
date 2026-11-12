import { type ChatItem, type ItemKind, ToolStatus } from "../chat-state";
import { toolSummary } from "../format";

const statusLabel: Record<ToolStatus, string> = {
  [ToolStatus.Running]: "Running…",
  [ToolStatus.Done]: "Done",
  [ToolStatus.Failed]: "Failed",
  [ToolStatus.Unfinished]: "Didn't finish",
};

export function ToolCard({
  item,
}: {
  item: Extract<ChatItem, { kind: ItemKind.Tool }>;
}) {
  return (
    <details className="tool" data-status={item.status}>
      <summary>
        <span className="tool-name">{item.name}</span>
        <span className="tool-target">{toolSummary(item.input)}</span>
        <span className="tool-status">{statusLabel[item.status]}</span>
      </summary>
      <div className="tool-body">
        <h3>Input</h3>
        <pre>{JSON.stringify(item.input, null, 2)}</pre>
        {item.output !== undefined && (
          <>
            <h3>Output</h3>
            <pre>{item.output || "(no output)"}</pre>
          </>
        )}
      </div>
    </details>
  );
}
