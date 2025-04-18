import React from 'react';

interface TodoCardProps {
  title: string;
  description: string;
  category: string;
}

const TodoCard: React.FC<TodoCardProps> = ({ title, description, category }) => {
  return (
    <div className="flex items-center justify-between p-5 rounded-lg bg-white shadow-[0_0_10px_0_rgba(0,0,0,0.03)] border border-[#ddd] mb-2.5">
      <div className="w-5 h-5 rounded-[35%] border border-[#333] cursor-pointer hover:bg-[#eee]"></div>
      <div>
        <div className="flex items-center justify-between pb-2.5 pl-2.5">
          <p className="font-font font-normal text-[13pt]">{title}</p>
          <div className="bg-[#333] px-1.5 py-0.75 rounded flex items-center justify-center">
            <p className="text-[10pt] font-semibold mt-[5px] text-white">{category}</p>
          </div>
        </div>
        <div className="flex items-center justify-between pb-2.5 pl-2.5">
          <p>{description}</p>
        </div>
      </div>
    </div>
  );
};

export default TodoCard;