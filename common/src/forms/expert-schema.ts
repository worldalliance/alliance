import { z } from "zod";

export const conversationExpertSchema = z.strictObject({
  userId: z.number(),
  userName: z.string(),
  userProfilePicture: z.string().nullable().optional(),
});
export type ConversationExpert = z.infer<typeof conversationExpertSchema>;
