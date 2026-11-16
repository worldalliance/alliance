import { z } from "zod";

export const conversationSchema = z.object({
  id: z.string(),
  folder: z.string(),
  /** The first message, shortened. */
  title: z.string(),
  startedAt: z.iso.datetime(),
});

export type Conversation = z.infer<typeof conversationSchema>;
