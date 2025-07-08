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
    <div className="flex flex-row gap-x-4 flex-1 relative pr-8 items-center">
      <ActionCardUserCount joined={totalUsers} completed={usersCompleted} />
      <div className="w-full h-3 bg-gray-100 rounded-[3px] mt-1">
        <div
          className="h-3 bg-[#5d9c2d] rounded-[3px]"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default UsersCompletedBar;
