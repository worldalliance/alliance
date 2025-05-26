const ProfileImage = ({ src }: { src: string }) => {
  return (
    <div className="w-29 h-29 rounded-full overflow-hidden bg-white flex items-center justify-center">
      <img
        src={src}
        alt="Profile"
        className="w-27 h-27 object-cover rounded-full"
      />
    </div>
  );
};

export default ProfileImage;
