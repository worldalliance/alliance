import type { QuoteBlock } from "@alliance/common/forms/display-blocks";
import { InspectorGroup } from "../kit/InspectorGroup";
import { UserPicker } from "../questions/UserPicker";
import { BlockTextField } from "./BlockTextField";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

export function EditableQuoteBlock(props: BaseDisplayBlockProps<QuoteBlock>) {
  return (
    <DisplayBlockWrapper {...props}>
      {({ block, onUpdate }) => (
        <InspectorGroup>
          <UserPicker
            label="Member"
            selected={
              block.userId == null
                ? null
                : {
                    userId: block.userId,
                    userName: block.userName ?? `User #${block.userId}`,
                    userProfilePicture: block.userProfilePicture,
                  }
            }
            onChange={(user) =>
              onUpdate({
                userId: user?.userId,
                userName: user?.userName,
                userProfilePicture: user?.userProfilePicture,
              })
            }
          />
          <BlockTextField
            label="Quote"
            multiline
            value={block.text}
            onChange={(text) => onUpdate({ text })}
            placeholder="Enter quote text"
          />
        </InspectorGroup>
      )}
    </DisplayBlockWrapper>
  );
}
