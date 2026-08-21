import List from "@alliance/sharedweb/ui/List";
import NewButton, {
  ButtonColor,
  ButtonSize,
} from "@alliance/sharedweb/ui/NewButton";
import { type ReactNode, useState } from "react";

const DEFAULT_VISIBLE_ITEMS = 10;

type ExpandableListProps = {
  children: ReactNode[];
};

const ExpandableList = ({ children }: ExpandableListProps) => {
  const [showAll, setShowAll] = useState(false);
  const hiddenItemCount = Math.max(0, children.length - DEFAULT_VISIBLE_ITEMS);
  const visibleChildren = showAll
    ? children
    : children.slice(0, DEFAULT_VISIBLE_ITEMS);

  return (
    <div className="flex flex-col gap-y-3">
      <List>{visibleChildren}</List>
      {hiddenItemCount > 0 && (
        <NewButton
          color={ButtonColor.White}
          size={ButtonSize.Small}
          className="self-center"
          onClick={() => setShowAll((current) => !current)}
        >
          {showAll ? "Show fewer" : `Show ${hiddenItemCount} more`}
        </NewButton>
      )}
    </div>
  );
};

export default ExpandableList;
