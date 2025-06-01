import { PropsWithChildren } from "react";

interface BadgeProps extends PropsWithChildren {
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ children, className }) => {
  return (
    <div
      className={`${className ?? ""} px-3 whitespace-nowrap rounded-md flex items-center justify-center text-[10pt] bg-slate-600 text-white py-1 pb-[2px] `}
    >
      {children}
    </div>
  );
};

export default Badge;
