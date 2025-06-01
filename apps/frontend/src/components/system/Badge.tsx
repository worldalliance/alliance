import { PropsWithChildren } from "react";

interface BadgeProps extends PropsWithChildren {
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ children, className }) => {
  return (
    <div
      className={`${className ?? ""} px-2 self-start font-avenir uppercase font-semibold whitespace-nowrap rounded-md flex items-center justify-center text-[8pt] bg-slate-600 text-white py-1 pb-[2px] `}
    >
      {children}
    </div>
  );
};

export default Badge;
