import type { QuoteBlock } from "@alliance/common/forms/display-blocks";
import { UserPicker } from "../UserPicker";
import { VariableTextField } from "../VariableTextField";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

function QuoteBlockEditor({
  activeBlock,
  onUpdate,
}: {
  activeBlock: QuoteBlock;
  onUpdate: (updates: Partial<QuoteBlock>) => void;
}) {
  const selected =
    activeBlock.userId == null
      ? null
      : {
          userId: activeBlock.userId,
          userName: activeBlock.userName ?? `User #${activeBlock.userId}`,
          userProfilePicture: activeBlock.userProfilePicture,
        };

  return (
    <div className="space-y-3 bg-zinc-100 px-5 py-4">
      <UserPicker
        selected={selected}
        onChange={(user) =>
          onUpdate({
            userId: user?.userId,
            userName: user?.userName,
            userProfilePicture: user?.userProfilePicture,
          })
        }
      />
      <VariableTextField
        multiline
        value={activeBlock.text}
        onChange={(text) => onUpdate({ text })}
        className="w-full text-gray-900 border-none outline-none !bg-transparent resize-none whitespace-pre-wrap"
        placeholder="Enter quote text"
        rows={Math.max(2, activeBlock.text.split("\n").length)}
        style={{ resize: "vertical" }}
      />
    </div>
  );
}

export function EditableQuoteBlock(props: BaseDisplayBlockProps<QuoteBlock>) {
  return (
    <DisplayBlockWrapper {...props}>
      {({ block: activeBlock, onUpdate: handleUpdate }) => (
        <QuoteBlockEditor activeBlock={activeBlock} onUpdate={handleUpdate} />
      )}
    </DisplayBlockWrapper>
  );
}
