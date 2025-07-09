import ActionCardUserCount from "./ActionCardUserCount";

export interface UsersCompletedBarProps {
  usersCompleted: number;
  totalUsers: number;
}

const UsersCompletedBar: React.FC<UsersCompletedBarProps> = ({
  usersCompleted,
  totalUsers,
}: UsersCompletedBarProps) => {
  const percentage = (usersCompleted / totalUsers) * 100;
  return (
    <div className="flex flex-col flex-1 relative items-end">
      <ActionCardUserCount joined={totalUsers} completed={usersCompleted} />
      <div className="w-full h-3 bg-zinc-100 rounded-[3px] mt-1">
        <div
          className="h-3 bg-green-600 rounded-[3px]"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default UsersCompletedBar;
