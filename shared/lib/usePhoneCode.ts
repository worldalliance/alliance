import { OtpError } from "@alliance/common/otp";
import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { z } from "zod";
import {
  userPhoneSendCode,
  userPhoneVerifyCode,
  type PendingPhoneCodeDto,
  type VerifyPhoneCodeDto,
} from "../client";
import { namedRefusalMessage } from "./hey-api";
import { queryKeys } from "./queryKeys";
import { meCache, meQuery } from "./useMe";

/** The server's copy for a refused send or verify. */
export const phoneCodeRefusalMessage = (error: unknown): string =>
  namedRefusalMessage(error, z.enum(OtpError));

/** Reloads what follows the member's saved number: whether texts can reach them, and the signed-in member, which says whether it is confirmed. */
export const reloadAfterPhoneSave = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.notificationSettings(),
  });
  return meCache(queryClient).refresh();
};

export function useSendPhoneCode() {
  return useMutation({
    mutationFn: async (phoneNumber: string): Promise<PendingPhoneCodeDto> =>
      (await userPhoneSendCode({ body: { phoneNumber }, throwOnError: true }))
        .data,
  });
}

/**
 * Confirming saves the number to the member's profile, so the member is
 * reloaded before it settles, and carries the number as confirmed even when
 * that reload fails.
 */
export function useVerifyPhoneCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      phoneNumber,
      ...body
    }: VerifyPhoneCodeDto & { phoneNumber: string }): Promise<void> => {
      await userPhoneVerifyCode({ body, throwOnError: true });
      await reloadAfterPhoneSave(queryClient);
      const member = queryClient.getQueryData(meQuery.queryKey)?.user;
      if (member) {
        meCache(queryClient).set({
          ...member,
          phoneNumber,
          phoneNumberVerified: true,
        });
      }
    },
  });
}
