import { cn } from "@alliance/shared/styles/util";
import { Earth, UserCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";

const HoverBadge: React.FC<React.PropsWithChildren<{ title: string }>> = ({
  children,
  title,
}) => (
  <Tooltip>
    <TooltipTrigger render={<span className="inline-block">{children}</span>} />
    <TooltipContent side="bottom">{title}</TooltipContent>
  </Tooltip>
);

interface UserDisplayNameProps extends React.PropsWithChildren {
  staff?: boolean;
  ambassador?: boolean;
  grouplead?: boolean;
  expert?: boolean;
  expertLabel?: string;
  underline?: boolean;
  className?: string;
}

const UserDisplayName: React.FC<UserDisplayNameProps> = ({
  children,
  staff = false,
  ambassador = false,
  grouplead = false,
  expert = false,
  expertLabel,
  underline = true,
  className = "",
}: React.PropsWithChildren<UserDisplayNameProps>) => {
  const hasRoleBadges = ambassador || grouplead || expert;

  return (
    <span>
      <span className={cn(underline && "hover:underline", className)}>
        {children}
      </span>
      {staff && (
        <HoverBadge title="Office member">
          <Earth
            size={16}
            className="ml-1.5 text-green inline -mt-px"
            strokeWidth={1.7}
          />
        </HoverBadge>
      )}
      {!staff && hasRoleBadges && (
        <span className="ml-1.5 inline-flex items-center gap-0.5 align-baseline">
          {ambassador && (
            <HoverBadge title="Consistently recruits new members">
              <span className="text-xs !bg-red-500 text-white rounded-xs px-1.5">
                Ambassador
              </span>
            </HoverBadge>
          )}
          {grouplead && (
            <HoverBadge title="Leads a member group">
              <UserCircle
                size={16}
                className="text-grouplead inline -mt-px"
                strokeWidth={2}
              />
            </HoverBadge>
          )}
          {expert && (
            <span className="text-xs !bg-orange-500 text-white rounded-xs px-1.5">
              {expertLabel || "Expert"}
            </span>
          )}
        </span>
      )}
    </span>
  );
};

export default UserDisplayName;
