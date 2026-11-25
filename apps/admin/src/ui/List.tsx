import { cn } from "./cn";

export interface ListProps extends React.PropsWithChildren {
  className?: string;
}

const List = ({ children, className }: ListProps) => {
  if (!children || (Array.isArray(children) && children.length === 0))
    return null;
  return (
    <div
      className={cn(
        "flex flex-col divide-y divide-line rounded-card border border-line bg-surface",
        className,
      )}
    >
      {children}
    </div>
  );
};

export default List;
