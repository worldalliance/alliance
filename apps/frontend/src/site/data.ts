import type {
  ProfileDto,
  StaffDirectoryEntryDto,
} from "@alliance/shared/client";
import {
  userFindOne,
  userMembersPublic,
  userStaffDirectory,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

/** Shown until the real pictures arrive, and for members who have none. */
export const FALLBACK_FACE = "/noun-user-icon.svg";

const PUBLIC_STALE_TIME = 60 * 60 * 1000;

export function usePublicMembers() {
  return useQuery({
    queryKey: queryKeys.publicMembers(),
    queryFn: () => userMembersPublic().then((res) => res.data ?? []),
    staleTime: PUBLIC_STALE_TIME,
  });
}

export function useStaffDirectory() {
  return useQuery({
    queryKey: queryKeys.staffDirectory(),
    queryFn: () => userStaffDirectory().then((res) => res.data ?? []),
    staleTime: PUBLIC_STALE_TIME,
  });
}

export function usePublicProfile(userId: number) {
  return useQuery({
    queryKey: queryKeys.publicProfile(userId),
    queryFn: () =>
      userFindOne({ path: { id: userId } }).then(
        (res): ProfileDto | null => res.data ?? null,
      ),
    staleTime: PUBLIC_STALE_TIME,
  });
}

/**
 * Every public member picture, in directory order. The product miniatures on
 * the home page draw their faces from here rather than repeating one avatar,
 * so the feed looks like the platform's own.
 */
export function useMemberFaces(): string[] {
  const { data } = usePublicMembers();
  return (data ?? [])
    .map((member) => member.profilePicture)
    .filter((picture): picture is string => Boolean(picture));
}

/**
 * `count` distinct faces starting `offset` into the roll, so two strips on one
 * screen show different people. Pads with the fallback while the request is
 * still out, keeping the strips' widths stable.
 */
export function pickFaces(
  faces: string[],
  count: number,
  offset: number,
): string[] {
  if (faces.length === 0)
    return Array.from({ length: count }, () => FALLBACK_FACE);
  return Array.from(
    { length: count },
    (_, i) => faces[(offset + i) % faces.length],
  );
}

export type SiteAuthor = { name: string; avatar: string };

/**
 * Whoever writes the outcome of an action, which is an office job — so the
 * miniature of a published update is attributed to the office rather than to
 * a member.
 */
export function useUpdateAuthor(): SiteAuthor | undefined {
  const { data } = useStaffDirectory();
  const staff: StaffDirectoryEntryDto | undefined = data?.[0];
  if (!staff) return undefined;
  return {
    name: staff.displayName,
    avatar: staff.profilePicture ?? FALLBACK_FACE,
  };
}
