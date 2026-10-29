import { GENERIC_FAILURE } from "@alliance/common/errorMessage";
import { KoraError } from "@alliance/common/kora";
import { OtpError } from "@alliance/common/otp";
import {
  koraAbandonCode,
  koraCompleteSignup,
  koraSendCode,
  koraSignOut,
  koraState,
  koraVerifyCode,
  type KoraParticipantStateDto,
  type StartKoraCodeDto,
} from "@alliance/shared/client";
import { thrownRefusalMessage } from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { retryUnlessRefused } from "@alliance/shared/lib/retryQuery";
import { deviceTimeZone, signupTimeZone } from "@alliance/shared/lib/timeZone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

const koraRefusalSchema = z.object({
  error: z.union([z.enum(OtpError), z.enum(KoraError)]),
  message: z.string(),
});

export const thrownKoraError = (
  error: unknown,
): OtpError | KoraError | undefined =>
  koraRefusalSchema.safeParse(error).data?.error;

/** A refusal the server named carries its copy at any status, including the 503 of a failed delivery. */
export function koraRefusalMessage(error: unknown): string {
  return (
    koraRefusalSchema.safeParse(error).data?.message ??
    thrownRefusalMessage({
      error,
      fallback: GENERIC_FAILURE,
      sessionExpired: GENERIC_FAILURE,
    })
  );
}

const timeZone = () => signupTimeZone(deviceTimeZone());

export function useKoraParticipant() {
  const queryClient = useQueryClient();
  const update = (change: Partial<KoraParticipantStateDto>) =>
    queryClient.setQueryData<KoraParticipantStateDto>(
      queryKeys.koraState(),
      (old) => old && { ...old, ...change },
    );
  const query = useQuery({
    queryKey: queryKeys.koraState(),
    queryFn: () => koraState({ throwOnError: true }).then((res) => res.data),
    retry: retryUnlessRefused(1),
    staleTime: Infinity,
  });
  const sendCode = useMutation({
    mutationFn: (body: StartKoraCodeDto) =>
      koraSendCode({ body, throwOnError: true }).then((res) => res.data),
    onSuccess: (pendingCode) => update({ pendingCode }),
  });
  const abandonCode = useMutation({
    mutationFn: () => koraAbandonCode({ throwOnError: true }),
    onSuccess: () => update({ pendingCode: null, signupPending: false }),
  });
  const verifyCode = useMutation({
    mutationFn: (code: string) =>
      koraVerifyCode({
        body: { code, timeZone: timeZone() },
        throwOnError: true,
      }).then((res) => res.data),
    onSuccess: ({ participant }) =>
      update({ participant, pendingCode: null, signupPending: !participant }),
    onError: (error) => {
      if (thrownKoraError(error) === OtpError.CodeInvalid) {
        update({ pendingCode: null });
      }
    },
  });
  const completeSignup = useMutation({
    mutationFn: (name: string) =>
      koraCompleteSignup({
        body: { name, timeZone: timeZone() },
        throwOnError: true,
      }).then((res) => res.data),
    onSuccess: (participant) => update({ participant, signupPending: false }),
    onError: (error) => {
      if (thrownKoraError(error) === KoraError.SignupExpired) {
        update({ signupPending: false });
      }
    },
  });
  const signOut = useMutation({
    mutationFn: () => koraSignOut({ throwOnError: true }),
    onSuccess: () => update({ participant: null }),
  });
  return {
    query,
    sendCode,
    abandonCode,
    verifyCode,
    completeSignup,
    signOut,
  };
}
