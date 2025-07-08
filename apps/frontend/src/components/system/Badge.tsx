import { PropsWithChildren } from "react";

interface BadgeProps extends PropsWithChildren {
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ children, className }: BadgeProps) => {
  return (
    <div
      className={`${
        className ?? ""
      } px-3 py-1 self-start  uppercase text-sm font-semibold whitespace-nowrap rounded-sm flex items-center justify-center bg-stone-200 text-gray-800 `}
    >
      {children}
    </div>
  );
};

export default Badge;
