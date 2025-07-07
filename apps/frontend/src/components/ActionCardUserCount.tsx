import usersIcon from "../assets/icons8-user-account-24.png";

const ActionCardUserCount = ({ count }: { count: number }) => {
  return (
    <div
      className="flex flex-row items-center gap-x-1 absolute top-5 right-4"
      title={`${count} members joined`}
    >
      <img
        src={usersIcon}
        alt="users"
        className="w-4 h-4"
        style={{ filter: "opacity(0.7)" }}
      />
      <span className="text-gray-600 font-bold font-avenir -mt-1">{count}</span>
    </div>
  );
};

export default ActionCardUserCount;
