import { mmsThreadGetThreadAdmin } from "@alliance/shared/client";
import type {
  MmsMessageDto,
  MmsThreadDto,
} from "@alliance/shared/client/types.gen";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { compareTexts, mergeTexts } from "./memberTexts";

/** Texts older than the polled newest page's first. */
type Kept = {
  phoneNumber: string | null;
  messages: MmsMessageDto[];
  hasOlder: boolean;
};

/** Where the polled texts begin: the first text a poll showed for this
 * number. */
type LogStart = {
  phoneNumber: string | null;
  first: MmsMessageDto | undefined;
};

const logStart = (thread: MmsThreadDto): LogStart => ({
  phoneNumber: thread.phoneNumber,
  first: thread.messages[0],
});

/** Older pages aren't polled. Texts that slide out of the polled newest page
 * stay shown, so a reader near the top keeps the text they're on.
 * `history` is what "Show older texts" loaded, `latest` what polls brought,
 * so a text sliding out of the polled page keeps its place and element. */
export function useOlderMemberTexts(userId: number, newest: MmsThreadDto) {
  const [kept, setKept] = useState<Kept | null>(null);
  const [polled, setPolled] = useState(newest);
  const [start, setStart] = useState(() => logStart(newest));
  const sameNumber = (k: Kept | null) =>
    k?.phoneNumber === newest.phoneNumber ? k : null;

  if (polled !== newest) {
    setPolled(newest);
    setKept(slidOut({ kept: sameNumber(kept), polled, newest }));
    if (start.phoneNumber !== newest.phoneNumber || !start.first)
      setStart(logStart(newest));
  }

  const current = sameNumber(kept);
  const messages = mergeTexts({
    older: current?.messages ?? [],
    newer: newest.messages,
  });

  const load = useMutation({
    mutationFn: (before: number) =>
      mmsThreadGetThreadAdmin({
        path: { userId },
        query: { before },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: (page) =>
      setKept((prev) => ({
        phoneNumber: page.phoneNumber,
        messages: mergeTexts({
          older: page.messages,
          newer: prev?.phoneNumber === page.phoneNumber ? prev.messages : [],
        }),
        hasOlder: page.hasOlder,
      })),
  });

  const oldest = messages[0];
  const first = start.phoneNumber === newest.phoneNumber && start.first;
  const loaded = (text: MmsMessageDto) =>
    first ? compareTexts(text, first) < 0 : false;
  return {
    messages,
    history: messages.filter(loaded),
    latest: messages.filter((text) => !loaded(text)),
    loadedPage: load.data,
    hasOlder: (current ?? newest).hasOlder,
    loadOlder: () => oldest && load.mutate(oldest.id),
    loading: load.isPending,
    failed: load.isError,
  };
}

const slidOut = (input: {
  kept: Kept | null;
  polled: MmsThreadDto;
  newest: MmsThreadDto;
}): Kept | null => {
  const { kept, polled, newest } = input;
  const first = newest.messages[0];
  if (!first || polled.phoneNumber !== newest.phoneNumber) return null;
  const shown = mergeTexts({
    older: kept?.messages ?? [],
    newer: [...polled.messages, first],
  });
  const messages = shown.slice(
    0,
    shown.findIndex((text) => text.id === first.id),
  );
  return messages.length === 0
    ? null
    : {
        phoneNumber: newest.phoneNumber,
        messages,
        hasOlder: (kept ?? polled).hasOlder,
      };
};
