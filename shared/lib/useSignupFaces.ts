import { useQuery } from "@tanstack/react-query";
import { userSignupSocialProof, type ProfileDto } from "../client";
import { queryKeys } from "./queryKeys";

/**
 * Faces above the agreement's "and N others have signed" line. The server
 * prefers the inviter's friends over random members, so a referred signup sees
 * people it might recognise.
 */
export function useSignupFaces(referralCode: string | null): ProfileDto[] {
  const { data } = useQuery({
    queryKey: queryKeys.signupSocialProof(referralCode),
    queryFn: () =>
      userSignupSocialProof({
        query: referralCode ? { code: referralCode } : undefined,
      }).then((res) => res.data?.profiles ?? []),
  });

  return data ?? [];
}
