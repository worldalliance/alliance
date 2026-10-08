import { z } from "zod";
import { isAllianceAppHostname, isValidHttpUrl } from "./url";

export const CUSTOM_LINK_RESERVED_SLUGS = new Set([
  "people",
  "join",
  "guide",
  "foundation",
  "governance",
  "description",
  "faq",
  "invite",
  "outreach-partner",
  "privacypolicy",
  "childsafety",
  "terms",
  "error",
  "progress",
  "projects",
  "waitlist",
  "utensilinitiative",
  "restaurantguide",
  "memberquotes",
  "actions",
  "mobile",
  "profile",
  "feed",
  "messages",
  "member",
  "user",
  "verifyemail",
  "forum",
  "tasks",
  "groups",
  "platform-walkthrough",
  "groups-guide",
  "settings",
  "information",
  "general-updates",
  "action-updates",
  "members",
  "flyerexport",
  "onboarding",
  "login",
  "signup",
  "resetpassword",
  "api",
  "assets",
  "build",
  "src",
  "node_modules",
  ".well-known",
  "priorities",
  "internal-governance",
  "roadmap",
  "terminology",
  "action-design",
  "ambassadors",
  "invites",
  "notifications",
  "search",
  "membership",
  "contract",
  "deleteaccount",
]);

const siteDestination = (value: string): boolean => {
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\s\x00-\x1f\x7f]/.test(value)
  ) {
    return false;
  }
  const parsed = new URL(value, "https://destination.invalid");
  const firstSegment = parsed.pathname.split("/")[1].toLowerCase();
  return !firstSegment || CUSTOM_LINK_RESERVED_SLUGS.has(firstSegment);
};

export const customLinkFieldsSchema = z.object({
  label: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .transform((value) => value.replace(/^\//, ""))
    .pipe(
      z
        .string()
        .regex(
          /^[a-z0-9][a-z0-9-]{0,63}$/,
          "Use 1–64 lowercase letters, numbers, or hyphens.",
        ),
    )
    .refine(
      (value) => !CUSTOM_LINK_RESERVED_SLUGS.has(value),
      "That path is reserved by the app.",
    ),
  destination: z
    .string()
    .trim()
    .min(1)
    .max(2048)
    .refine((value) => {
      if (value.startsWith("/")) return siteDestination(value);
      if (!isValidHttpUrl(value) || /[\\\s\x00-\x1f\x7f]/.test(value))
        return false;
      const parsed = new URL(value);
      if (isAllianceAppHostname(parsed.hostname)) {
        return (
          !parsed.username &&
          !parsed.password &&
          siteDestination(parsed.pathname + parsed.search + parsed.hash)
        );
      }
      return !parsed.username && !parsed.password;
    }, "Use an HTTP(S) URL or an existing site path; custom links cannot point to other custom links."),
});
