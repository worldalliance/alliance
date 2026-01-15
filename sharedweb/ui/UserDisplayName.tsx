interface UserDisplayNameProps extends React.PropsWithChildren {
  staff?: boolean;
  grouplead?: boolean;
  expert?: boolean;
  expertLabel?: string;
  underline?: boolean;
  className?: string;
}

const UserDisplayName: React.FC<UserDisplayNameProps> = ({
  children,
  staff = false,
  grouplead = false,
  expert = false,
  expertLabel,
  underline = true,
  className = "",
}: React.PropsWithChildren<UserDisplayNameProps>) => {
  return (
    <span>
      <span className={`${underline ? "hover:underline" : ""} ${className}`}>
        {children}
      </span>
      {staff && (
        <span className="ml-1 text-xs !bg-blue text-white rounded-xs px-1.5">
          Staff
        </span>
      )}
      {!staff && grouplead && (
        <span className="ml-1 text-xs !bg-grouplead text-white rounded-xs px-1.5">
          Lead
        </span>
      )}
      {expert && (
        <span className="ml-1 text-xs !bg-orange-500 text-white rounded-xs px-1.5">
          {expertLabel || "Expert"}
        </span>
      )}
    </span>
  );
};

export default UserDisplayName;
