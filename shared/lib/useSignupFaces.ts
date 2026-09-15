import { useQuery } from "@tanstack/react-query";
import { userSignupSocialProof, type ProfileDto } from "../client";
import { queryKeys } from "./queryKeys";

/**
 * Member avatars for the signup screens. The server prefers the inviter's
 * friends over random members, so a referred signup sees people it might
 * recognise, and returns five unless `count` asks for more.
 */
export function useSignupFaces(
  referralCode: string | null,
  params?: { enabled?: boolean; count?: number },
): ProfileDto[] {
  const count = params?.count;

  const { data } = useQuery({
    enabled: params?.enabled ?? true,
    queryKey: queryKeys.signupSocialProof(referralCode, count),
    queryFn: () =>
      userSignupSocialProof({
        query: {
          ...(referralCode ? { code: referralCode } : {}),
          ...(count === undefined ? {} : { count }),
        },
      }).then((res) => res.data?.profiles ?? []),
  });

  return data ?? [];
}
