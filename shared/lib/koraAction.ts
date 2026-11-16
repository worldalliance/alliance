import { withCount } from "@alliance/common/plural";

/** Copy for a Kora review action's task panel, shared by web and mobile. */
export const KORA_ACTION_COPY = {
  heading: "Review chatbot transcripts",
  intro: (minutes: number | null) =>
    `Rate how AI chatbots handle sensitive topics with children${minutes ? `. It takes about ${withCount(minutes, "minute")}` : ""}, and you can stop and pick up where you left off.`,
  start: "Start reviewing",
  completeHeading: "Task complete",
  continueNote:
    "Thank you. You can keep reviewing chat transcripts if you’d like.",
  reviewMore: "Review more transcripts",
};
