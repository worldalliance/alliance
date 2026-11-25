import { reminderEmailHtml } from "@alliance/common/reminderKeywords";
import { Bell } from "lucide-react";

export const TextMockup = ({ message }: { message: string }) => (
  <figure className="flex w-80 flex-col gap-1.5 rounded-card border border-line bg-surface p-3">
    <figcaption className="text-center text-caption text-fg-muted">
      Text message
    </figcaption>
    <p className="max-w-4/5 rounded-card rounded-bl-sm bg-surface-2 px-3 py-2 whitespace-pre-wrap">
      {message}
    </p>
  </figure>
);

export const PushMockup = ({ message }: { message: string }) => (
  <figure
    aria-label="Push notification"
    className="flex w-80 gap-2.5 rounded-card border border-line bg-surface-2 p-3"
  >
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-fg">
      <Bell className="size-4" aria-hidden />
    </span>
    <span className="min-w-0">
      <span className="flex justify-between text-caption">
        <span className="font-semibold">Alliance</span>
        <span className="text-fg-muted">now</span>
      </span>
      <span className="block whitespace-pre-wrap">{message}</span>
    </span>
  </figure>
);

// The img rule is the server's mail layout.pug's, which wraps the sent email.
// The base target opens a clicked link in a new tab, not in the preview's frame.
const emailHtml = (body: string) =>
  `<base target="_blank"><style>img{max-width:100%;height:auto}</style><body style="margin:0;font:14px Arial,sans-serif;color:#18181b">${reminderEmailHtml(body)}</body>`;

export const EmailMockup = ({
  subject,
  body,
  recipient,
}: {
  subject: string | null;
  body: string;
  recipient: string;
}) => (
  <figure
    aria-label="Email"
    className="flex max-w-2xl flex-col gap-3 rounded-card border border-line bg-surface p-4"
  >
    <h4 className="text-heading font-semibold">
      {subject ?? "(no subject)"}
    </h4>
    <div className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-accent-fg">
        A
      </span>
      <span>
        <span className="font-semibold">Alliance</span>
        <span className="block text-caption text-fg-muted">
          to {recipient}
        </span>
      </span>
    </div>
    {/* Sandboxed: keyword values such as #{fullname} are member-entered text. */}
    <iframe
      title="Email body"
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      srcDoc={emailHtml(body)}
      className="h-64 w-full"
    />
  </figure>
);
