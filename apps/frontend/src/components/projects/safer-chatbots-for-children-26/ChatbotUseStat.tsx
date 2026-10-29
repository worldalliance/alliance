import { CHATBOT_USE_STAT } from "./copy";

export function ChatbotUseStat() {
  return (
    <a
      href={CHATBOT_USE_STAT.href}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-4"
    >
      {CHATBOT_USE_STAT.claim}
    </a>
  );
}
