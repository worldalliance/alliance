import { z } from "zod";
import { AgentKind } from "./agent-kind";

export const conversationSchema = z.object({
  id: z.string(),
  folder: z.string(),
  /** The first message, shortened. */
  title: z.string(),
  startedAt: z.iso.datetime(),
  /** Fixed when the conversation starts. */
  agent: z.enum(AgentKind),
});

export type Conversation = z.infer<typeof conversationSchema>;
