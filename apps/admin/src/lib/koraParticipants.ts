import type {
  KoraAdminAbandonedSignupDto,
  KoraAdminOverviewDto,
  KoraAdminParticipantDto,
  OAuthProvider,
  OtpChannel,
} from "@alliance/shared/client";
import { format } from "date-fns";
import Papa from "papaparse";

const CHANNEL_LABEL: Record<OtpChannel, string> = {
  email: "Email code",
  sms: "SMS code",
};

const PROVIDER_LABEL: Record<OAuthProvider, string> = {
  google: "Google",
  apple: "Apple",
};

export function contactOf(participant: KoraAdminParticipantDto): string {
  return participant.email ?? participant.phoneNumber ?? "";
}

export function participantMethods(
  participant: KoraAdminParticipantDto,
): string[] {
  const channel: OtpChannel = participant.email !== null ? "email" : "sms";
  return [
    CHANNEL_LABEL[channel],
    ...participant.providers.map((provider) => PROVIDER_LABEL[provider]),
  ];
}

export function abandonedMethod(signup: KoraAdminAbandonedSignupDto): string {
  return signup.provider
    ? PROVIDER_LABEL[signup.provider]
    : CHANNEL_LABEL[signup.channel];
}

/** Case-insensitive; a query of digits also matches phone numbers ignoring formatting. */
export function matchesSearch(fields: string[], query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const digits = needle.replace(/[^\d]/g, "");
  return fields.some((field) => {
    const haystack = field.toLowerCase();
    return (
      haystack.includes(needle) ||
      (digits.length > 0 &&
        /^[\d\s()+-]+$/.test(needle) &&
        haystack.replace(/[^\d]/g, "").includes(digits))
    );
  });
}

export enum ParticipantSort {
  Name = "name",
  Contact = "contact",
  SignedUp = "signedUp",
}

export enum SortDirection {
  Asc = "asc",
  Desc = "desc",
}

const SORT_KEY: Record<
  ParticipantSort,
  (participant: KoraAdminParticipantDto) => string
> = {
  [ParticipantSort.Name]: (participant) => participant.name.toLowerCase(),
  [ParticipantSort.Contact]: (participant) =>
    contactOf(participant).toLowerCase(),
  [ParticipantSort.SignedUp]: (participant) => participant.createdAt,
};

export function sortParticipants(
  participants: KoraAdminParticipantDto[],
  sort: { by: ParticipantSort; direction: SortDirection },
): KoraAdminParticipantDto[] {
  const key = SORT_KEY[sort.by];
  const sign = sort.direction === SortDirection.Asc ? 1 : -1;
  return [...participants].sort((a, b) => sign * key(a).localeCompare(key(b)));
}

/** Newest day first; days are UTC dates, as the member waitlist's metrics bucket by UTC. */
export function signupsPerDay(
  participants: KoraAdminParticipantDto[],
): { day: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const participant of participants) {
    const day = new Date(participant.createdAt).toISOString().slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return [...counts]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => b.day.localeCompare(a.day));
}

// Papa's default also escapes a leading `+`, which would mangle every E.164 phone number.
const FORMULA_START = /^[=@\t\r]|^[+-](?!\d+$)/;

export function buildKoraCsv(overview: KoraAdminOverviewDto): string {
  const participants = overview.participants.map((participant) => ({
    Status: "participant",
    Name: participant.name,
    Email: participant.email ?? "",
    Phone: participant.phoneNumber ?? "",
    "Sign-in methods": participantMethods(participant).join("; "),
    "Time zone": participant.timeZone ?? "",
    Date: participant.createdAt,
  }));
  const abandoned = overview.abandonedSignups.map((signup) => ({
    Status: signup.recovered ? "recovered" : "abandoned",
    Name: "",
    Email: signup.channel === "email" ? signup.destination : "",
    Phone: signup.channel === "sms" ? signup.destination : "",
    "Sign-in methods": abandonedMethod(signup),
    "Time zone": "",
    Date: signup.verifiedAt,
  }));
  return Papa.unparse([...participants, ...abandoned], {
    escapeFormulae: FORMULA_START,
  });
}

export const formatKoraDate = (iso: string) =>
  format(new Date(iso), "MMM d, yyyy h:mm a");
