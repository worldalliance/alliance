import { PropsWithChildren } from "react";

interface BadgeProps extends PropsWithChildren {
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ children, className }) => {
  return (
    <div
      className={`px-2 !font-itc whitespace-nowrap rounded-md flex items-center justify-center text-[9pt] bg-slate-600 text-white py-[3px] pb-[1px] ${className ?? ""}`}
    >
      {children}
    </div>
  );
};

export default Badge;
