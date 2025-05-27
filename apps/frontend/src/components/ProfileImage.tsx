const ProfileImage = ({
  src,
  className,
}: {
  src: string | null;
  className?: string;
}) => {
  return (
    <div
      className={`w-29 h-29 rounded-full overflow-hidden bg-white flex items-center justify-center ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt="Profile"
          className="w-27 h-27 object-cover rounded-full"
        />
      ) : (
        <div className="w-27 h-27 bg-stone-300 rounded-full" />
      )}
    </div>
  );
};

export default ProfileImage;
