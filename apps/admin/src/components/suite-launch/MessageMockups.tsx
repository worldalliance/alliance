import { Bell } from "lucide-react";

export const TextMockup = ({ message }: { message: string }) => (
  <figure className="flex w-80 flex-col gap-1 rounded-3xl bg-zinc-100 p-3">
    <figcaption className="text-center text-xs text-zinc-500">
      Text Message
    </figcaption>
    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-zinc-300 px-3 py-2 text-sm text-black">
      {message}
    </p>
  </figure>
);

export const PushMockup = ({ message }: { message: string }) => (
  <figure className="flex w-80 gap-2 rounded-2xl bg-zinc-200/80 p-3 shadow-sm backdrop-blur">
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-green text-white">
      <Bell className="size-4" aria-hidden />
    </span>
    <span className="min-w-0 text-sm">
      <span className="flex justify-between text-xs">
        <span className="font-semibold">Alliance</span>
        <span className="text-zinc-500">now</span>
      </span>
      <span className="block whitespace-pre-wrap">{message}</span>
    </span>
  </figure>
);

export const EmailMockup = ({
  subject,
  body,
  recipient,
}: {
  subject: string | null;
  body: string;
  recipient: string;
}) => (
  <figure className="flex max-w-2xl flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 font-[Arial,sans-serif]">
    <h4 className="text-xl text-zinc-900">{subject ?? "(no subject)"}</h4>
    <div className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green text-lg text-white">
        A
      </span>
      <span className="text-sm">
        <span className="font-semibold">Alliance</span>{" "}
        <span className="text-xs text-zinc-500">
          &lt;alliance@thealliance.org&gt;
        </span>
        <span className="block text-xs text-zinc-500">to {recipient}</span>
      </span>
    </div>
    <p className="whitespace-pre-wrap pl-13 text-sm text-zinc-900">{body}</p>
  </figure>
);
