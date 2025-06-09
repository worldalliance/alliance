import { PropsWithChildren } from "react";

interface BadgeProps extends PropsWithChildren {
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ children, className }: BadgeProps) => {
  return (
    <div
      className={`${
        className ?? ""
      } px-4 py-2 self-start font-avenir uppercase font-semibold whitespace-nowrap rounded-sm flex items-center justify-center text-[9pt] bg-[#636b75] text-white `}
    >
      {children}
    </div>
  );
};

export default Badge;
