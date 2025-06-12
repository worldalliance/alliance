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
    <div className="flex flex-col gap-x-2 flex-1 relative pr-32">
      <div className="w-full h-3 bg-gray-100 rounded-[3px]">
        <div
          className="h-3 bg-[#5d9c2d] rounded-[3px]"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <p className="text-gray-800 font-avenir text-sm p-1 pb-0">
        {usersCompleted} members completed, out of {totalUsers} committed
      </p>
    </div>
  );
};

export default UsersCompletedBar;
