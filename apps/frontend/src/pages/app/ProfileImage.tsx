const ProfileImage = ({
  src,
  className,
}: {
  src: string;
  className?: string;
}) => {
  return (
    <div
      className={`w-29 h-29 rounded-full overflow-hidden bg-white flex items-center justify-center ${className}`}
    >
      <img
        src={src}
        alt="Profile"
        className="w-27 h-27 object-cover rounded-full"
      />
    </div>
  );
};

export default ProfileImage;
