import type { ProfileDto } from "../client";

export type MessageRecipient = Pick<
  ProfileDto,
  "id" | "displayName" | "profilePicture"
>;

export interface MessageRecipientSelectProps {
  users: MessageRecipient[];
  selectedUserIds: number[];
  onChange: (userIds: number[]) => void;
  loading?: boolean;
  single?: boolean;
}

export const recipientNameOf = (user: MessageRecipient) => user.displayName;

export const missingRecipient = (id: number): MessageRecipient => ({
  id,
  displayName: `User #${id}`,
  profilePicture: null,
});
