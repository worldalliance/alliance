import { cn } from "@alliance/shared/styles/util";

export interface ListProps extends React.PropsWithChildren {
  className?: string;
}

/**
 * Hover treatment for a row that acts as a button. Outlines the row instead of
 * shading it: the page behind is already near-white, so a tint dark enough to
 * notice reads as a hole in the card rather than a highlight.
 */
export const interactiveListRowClass =
  "cursor-pointer transition-shadow hover:inset-ring-1 hover:inset-ring-zinc-300";

const List: React.FC<ListProps> = ({ children, className }) => {
  if (!children || (Array.isArray(children) && children.length === 0))
    return null;
  return (
    <div
      className={cn(
        "flex flex-col divide-y divide-zinc-200 bg-white rounded",
        className,
      )}
    >
      {children}
    </div>
  );
};

export default List;
