import React from 'react';
import './TodoCard.css';

interface TodoCardProps {
  title: string;
  description: string;
  category: string;
}

const TodoCard: React.FC<TodoCardProps> = ({ title, description, category }) => {
  return (
    <div className="todo-card row">
      <div className="checkbox"></div>
      <div>
        <div className="row">
          <p className="todo-card-title">{title}</p>
          <div className="badge">
            <p>{category}</p>
          </div>
        </div>
        <div className="row">
          <p>{description}</p>
        </div>
      </div>
    </div>
  );
};

export default TodoCard;