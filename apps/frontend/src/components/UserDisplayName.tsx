interface UserDisplayNameProps extends React.PropsWithChildren {
  staff?: boolean;
  grouplead?: boolean;
  underline?: boolean;
}

const UserDisplayName: React.FC<UserDisplayNameProps> = ({
  children,
  staff = false,
  grouplead = false,
  underline = true,
}: React.PropsWithChildren<UserDisplayNameProps>) => {
  return (
    <>
      <span
        className={`${underline ? "hover:underline" : ""}
        }`}
      >
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
    </>
  );
};

export default UserDisplayName;
