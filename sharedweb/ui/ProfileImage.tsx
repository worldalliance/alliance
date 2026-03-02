const ProfileImage = ({
  pfp,
  className,
  size = "large",
}: {
  pfp: string | null;
  className?: string;
  size?: "mini" | "smaller" | "small" | "medium" | "large" | "huge";
}) => {
  const sizeClass = {
    mini: "w-4 h-4 rounded-xs",
    smaller: "w-5 h-5 rounded-xs",
    small: "w-6 h-6 rounded",
    medium: "w-8 h-8 rounded",
    large: "w-9 h-9 rounded",
    huge: "w-29 h-29 rounded",
  };
  return (
    <img
      src={!!pfp ? pfp : "/noun-user-icon.svg"}
      loading="lazy"
      className={`object-cover bg-white shrink-0 inline ${sizeClass[size]} ${
        !pfp ? "ring-1 ring-zinc-300 ring-inset" : ""
      } ${className ?? ""}`}
    />
  );
};

export default ProfileImage;
