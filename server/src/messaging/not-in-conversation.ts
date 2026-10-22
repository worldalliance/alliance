import { ForbiddenException } from "@nestjs/common";

export const notInConversation = () =>
  new ForbiddenException("You are not part of this conversation.");
