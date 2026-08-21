import {
  notifsSetReadContent,
  UnreadContentType,
} from "@alliance/shared/client";
import { useEffect, useMemo } from "react";

const completedKeys = new Set<string>();
const inflightKeys = new Set<string>();

function getContentKey(contentType: UnreadContentType, contentId: number) {
  return `${contentType}:${contentId}`;
}

export function useMarkUnreadContentRead(params: {
  contentType: UnreadContentType;
  contentIds: number[];
  enabled?: boolean;
  onMarked?: (contentType: UnreadContentType, contentIds: number[]) => void;
}) {
  const { contentType, contentIds, enabled = true, onMarked } = params;

  const normalizedIds = useMemo(
    () =>
      Array.from(
        new Set(
          contentIds.filter(
            (contentId): contentId is number =>
              Number.isInteger(contentId) && contentId > 0,
          ),
        ),
      ).sort((left, right) => left - right),
    [contentIds],
  );

  useEffect(() => {
    if (!enabled || normalizedIds.length === 0) {
      return;
    }

    const unreadIds = normalizedIds.filter((contentId) => {
      const key = getContentKey(contentType, contentId);
      return !completedKeys.has(key) && !inflightKeys.has(key);
    });

    if (unreadIds.length === 0) {
      return;
    }

    unreadIds.forEach((contentId) => {
      inflightKeys.add(getContentKey(contentType, contentId));
    });

    void notifsSetReadContent({
      body: {
        contentType,
        contentIds: unreadIds,
      },
    })
      .then(() => {
        unreadIds.forEach((contentId) => {
          const key = getContentKey(contentType, contentId);
          inflightKeys.delete(key);
          completedKeys.add(key);
        });
        onMarked?.(contentType, unreadIds);
      })
      .catch((error) => {
        unreadIds.forEach((contentId) => {
          inflightKeys.delete(getContentKey(contentType, contentId));
        });
        console.error("failed to mark unread content as read", error);
      });
  }, [contentType, enabled, normalizedIds, onMarked]);
}
