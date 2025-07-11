import usersIcon from "../assets/icons8-user-account-24.png";

const ActionCardUserCount = ({
  joined,
  completed,
}: {
  joined: number;
  completed?: number;
}) => {
  return (
    <div
      className="flex flex-row items-center gap-x-1"
      title={`${joined} members joined`}
    >
      <img
        src={usersIcon}
        alt="users"
        className="w-4 h-4"
        style={{ filter: "opacity(0.4)" }}
      />
      <span className="text-zinc-500 text-sm text-nowrap font-ibm">
        {completed !== undefined && `${completed} / `}
        {joined}
      </span>
    </div>
  );
};

export default ActionCardUserCount;
