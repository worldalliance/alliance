import { useEffect, useState } from "react";

export const EXPERT_TYPING_MS = 750;

/**
 * Whether the expert is "typing" a reply to `choice`: true for
 * {@link EXPERT_TYPING_MS} after the member picks it, never for the choice the
 * field opened with, since the dots answer a pick just made, and never for a
 * choice with no reply, so its note box shows at once.
 */
export function useExpertTyping(params: {
  choice: string | undefined;
  hasReply: boolean;
  reduceMotion: boolean;
}): boolean {
  const { choice, hasReply, reduceMotion } = params;
  const [previousChoice, setPreviousChoice] = useState(choice);
  const [typingFor, setTypingFor] = useState<string | undefined>(undefined);
  if (choice !== previousChoice) {
    setPreviousChoice(choice);
    setTypingFor(choice);
  }

  useEffect(() => {
    if (typingFor === undefined) return;
    const timer = setTimeout(() => setTypingFor(undefined), EXPERT_TYPING_MS);
    return () => clearTimeout(timer);
  }, [typingFor]);

  return (
    hasReply && !reduceMotion && typingFor !== undefined && typingFor === choice
  );
}
