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
    <div className="flex flex-col gap-x-2">
      <p className="text-[#5d9c2d] font-bold">
        {usersCompleted} members completed, out of {totalUsers} committed
      </p>
      <div className="w-full h-4 bg-gray-200 rounded-sm">
        <div
          className="h-4 bg-[#5d9c2d] rounded-sm"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default UsersCompletedBar;
