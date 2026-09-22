import { R } from "@alliance/common/result";
import {
  Bot,
  Braces,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Flag,
  Terminal,
  User,
  Wrench,
} from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import Markdown from "react-markdown";
import { z } from "zod";

enum MessageKind {
  System = "system",
  Assistant = "assistant",
  User = "user",
  Result = "result",
  Other = "other",
}

const MESSAGE_ICON: Record<MessageKind, ReactNode> = {
  [MessageKind.System]: <Terminal size={13} />,
  [MessageKind.Assistant]: <Bot size={13} />,
  [MessageKind.User]: <User size={13} />,
  [MessageKind.Result]: <Flag size={13} />,
  [MessageKind.Other]: <Braces size={13} />,
};

const messageSchema = z.object({
  type: z.string(),
  subtype: z.string().optional(),
});

const systemSchema = z.object({
  subtype: z.string().optional(),
  model: z.string().optional(),
  cwd: z.string().optional(),
  tools: z.array(z.string()).optional(),
  hook_name: z.string().optional(),
  outcome: z.string().optional(),
});

const textBlockSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

const thinkingBlockSchema = z.object({
  type: z.literal("thinking"),
  thinking: z.string(),
});

const toolUseBlockSchema = z.object({
  type: z.literal("tool_use"),
  name: z.string(),
  input: z.unknown(),
});

const toolResultBlockSchema = z.object({
  type: z.literal("tool_result"),
  content: z.unknown(),
  is_error: z.boolean().optional(),
});

const chatSchema = z.object({
  message: z.object({
    content: z.union([z.string(), z.array(z.unknown())]),
  }),
});

const resultSchema = z.object({
  subtype: z.string().optional(),
  is_error: z.boolean().optional(),
  result: z.string().optional(),
  duration_ms: z.number().optional(),
  num_turns: z.number().optional(),
  total_cost_usd: z.number().optional(),
});

const codexItemSchema = z.object({
  type: z.enum(["item.started", "item.updated", "item.completed"]),
  item: z.object({
    type: z.string(),
    text: z.string().optional(),
    command: z.string().optional(),
    aggregated_output: z.string().optional(),
  }),
});

function kindOf(type: string): MessageKind {
  const known = z.enum(MessageKind).safeParse(type);
  return known.success && known.data !== MessageKind.Other
    ? known.data
    : MessageKind.Other;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function resultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return text(content);

  return content
    .map((block) => {
      const asText = textBlockSchema.safeParse(block);
      return asText.success ? asText.data.text : text(block);
    })
    .join("\n");
}

function clamp(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit)}\n…` : value;
}

/**
 * The fields worth reading for the tools claude reaches for most, first one
 * first. Tool names are an open set, so anything missing falls back to json.
 */
const TOOL_FIELDS: Record<string, string[]> = {
  Bash: ["command", "description"],
  Read: ["file_path", "offset", "limit"],
  Write: ["file_path", "content"],
  Edit: ["file_path", "old_string", "new_string"],
  Glob: ["pattern", "path"],
  Grep: ["pattern", "path", "glob", "output_mode"],
  Task: ["description", "subagent_type", "prompt"],
  Skill: ["skill", "args"],
  WebFetch: ["url", "prompt"],
  WebSearch: ["query"],
  TodoWrite: ["todos"],
  ReportFindings: ["findings"],
};

function toolInput(input: unknown): Record<string, unknown> {
  const parsed = z.record(z.string(), z.unknown()).safeParse(input);
  return parsed.success ? parsed.data : {};
}

function fieldText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

function toolPreview(params: { name: string; input: unknown }): string {
  const primary = TOOL_FIELDS[params.name]?.[0];
  if (!primary) return params.name;

  const value = fieldText(toolInput(params.input)[primary]);
  return value ? `${params.name} ${firstLine(value, 70)}` : params.name;
}

function ToolUse({ name, input }: { name: string; input: unknown }) {
  const fields = TOOL_FIELDS[name];
  const values = toolInput(input);
  const shown = fields?.filter((field) => values[field] !== undefined);

  return (
    <div className="tool">
      <span className="tool-name">
        <Wrench size={12} />
        {name}
      </span>
      {shown?.length ? (
        <dl className="tool-fields">
          {shown.map((field) => (
            <Fragment key={field}>
              <dt>{field}</dt>
              <dd>{clamp(fieldText(values[field]), 1200)}</dd>
            </Fragment>
          ))}
        </dl>
      ) : (
        <pre>{clamp(text(input), 1200)}</pre>
      )}
    </div>
  );
}

function Blocks({ content }: { content: unknown }) {
  if (typeof content === "string") return <p>{content}</p>;
  if (!Array.isArray(content)) return <pre>{text(content)}</pre>;

  return (
    <>
      {content.map((block, index) => {
        const asText = textBlockSchema.safeParse(block);
        if (asText.success) {
          return (
            <div className="markdown" key={index}>
              <Markdown>{asText.data.text}</Markdown>
            </div>
          );
        }

        const asThinking = thinkingBlockSchema.safeParse(block);
        if (asThinking.success) {
          return (
            <p className="muted" key={index}>
              {clamp(asThinking.data.thinking, 600)}
            </p>
          );
        }

        const asToolUse = toolUseBlockSchema.safeParse(block);
        if (asToolUse.success) {
          return (
            <ToolUse
              key={index}
              name={asToolUse.data.name}
              input={asToolUse.data.input}
            />
          );
        }

        const asToolResult = toolResultBlockSchema.safeParse(block);
        if (asToolResult.success) {
          return (
            <pre
              key={index}
              className={asToolResult.data.is_error ? "bad" : undefined}
            >
              {clamp(resultText(asToolResult.data.content), 1200)}
            </pre>
          );
        }

        return <pre key={index}>{clamp(text(block), 800)}</pre>;
      })}
    </>
  );
}

function firstLine(value: string, limit: number): string {
  const line = value.trim().split("\n")[0] ?? "";
  return line.length > limit ? `${line.slice(0, limit)}…` : line;
}

function previewOf(content: unknown): string {
  if (typeof content === "string") return firstLine(content, 90);
  if (!Array.isArray(content)) return "";

  return content
    .map((block) => {
      const asText = textBlockSchema.safeParse(block);
      if (asText.success) return firstLine(asText.data.text, 90);

      const asToolUse = toolUseBlockSchema.safeParse(block);
      if (asToolUse.success) {
        return toolPreview({
          name: asToolUse.data.name,
          input: asToolUse.data.input,
        });
      }

      const asToolResult = toolResultBlockSchema.safeParse(block);
      if (asToolResult.success)
        return firstLine(resultText(asToolResult.data.content), 90);

      const asThinking = thinkingBlockSchema.safeParse(block);
      if (asThinking.success) {
        const line = firstLine(asThinking.data.thinking, 70);
        return line ? `thinking: ${line}` : "thinking";
      }

      return "";
    })
    .filter(Boolean)
    .join(" · ");
}

function summarize(params: { kind: MessageKind; message: unknown }): {
  preview: string;
  body: ReactNode;
} {
  const { kind, message } = params;

  const codex = codexItemSchema.safeParse(message);
  if (codex.success) {
    const item = codex.data.item;
    const json = R.fromThrowable(() => JSON.parse(item.text ?? ""));
    const report = z
      .object({ report: z.string() })
      .safeParse(json.ok ? json.value : null);
    const content = report.success ? report.data.report : item.text;
    return {
      preview: firstLine(content ?? item.command ?? item.type, 90),
      body: content ? (
        <div className="markdown">
          <Markdown>{content}</Markdown>
        </div>
      ) : item.command ? (
        <>
          <pre>{item.command}</pre>
          <pre>{item.aggregated_output}</pre>
        </>
      ) : (
        <pre>{text(message)}</pre>
      ),
    };
  }

  if (kind === MessageKind.System) {
    const system = systemSchema.safeParse(message);
    const data = system.success ? system.data : {};
    const facts = [
      data.hook_name,
      data.outcome,
      data.model,
      data.cwd,
      data.tools ? `${data.tools.length} tools` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return { preview: facts, body: <p className="muted">{facts}</p> };
  }

  if (kind === MessageKind.Result) {
    const result = resultSchema.safeParse(message);
    const data = result.success ? result.data : {};
    const stats = [
      data.subtype,
      data.duration_ms ? `${Math.round(data.duration_ms / 1000)}s` : null,
      data.num_turns ? `${data.num_turns} turns` : null,
      data.total_cost_usd ? `$${data.total_cost_usd.toFixed(2)}` : null,
    ].filter(Boolean);

    return {
      preview: stats.join(" · "),
      body: (
        <>
          <p className="muted">{stats.join(" · ")}</p>
          {data.result && (
            <div className="markdown">
              <Markdown>{data.result}</Markdown>
            </div>
          )}
        </>
      ),
    };
  }

  const chat = chatSchema.safeParse(message);
  return {
    preview: chat.success ? previewOf(chat.data.message.content) : "",
    body: chat.success ? (
      <Blocks content={chat.data.message.content} />
    ) : (
      <pre>{clamp(text(message), 800)}</pre>
    ),
  };
}

function Message({ message }: { message: unknown }) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState(false);

  const parsed = messageSchema.safeParse(message);
  const kind = parsed.success ? kindOf(parsed.data.type) : MessageKind.Other;
  const { preview, body } = summarize({ kind, message });

  return (
    <li className={`message ${kind}`}>
      <button className="message-head" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {MESSAGE_ICON[kind]}
        <span>{parsed.success ? parsed.data.type : "message"}</span>
        {parsed.success && parsed.data.subtype && (
          <span className="subtype">{parsed.data.subtype}</span>
        )}
        <span className="preview">{preview}</span>
      </button>

      {open && (
        <div className="message-body">
          <button
            className="icon"
            onClick={() => setRaw(!raw)}
            aria-label="Show the raw json"
            title="Show the raw json"
          >
            <Braces size={12} />
          </button>
          {raw ? <pre>{JSON.stringify(message, null, 2)}</pre> : body}
        </div>
      )}
    </li>
  );
}

export function Transcript({ messages }: { messages: unknown[] }) {
  if (messages.length === 0) {
    return (
      <p className="muted">
        <CircleAlert size={13} /> no messages
      </p>
    );
  }

  return (
    <ul className="transcript">
      {messages.map((message, index) => (
        <Message key={index} message={message} />
      ))}
    </ul>
  );
}
