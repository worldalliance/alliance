import React, { useEffect, useState } from "react";
import ActionItemCard, {
  ActionCardAction,
} from "../../components/ActionItemCard";
import ActionPromptCard from "../../components/ActionPromptCard";
import Button, { ButtonColor } from "../../components/system/Button";
import { HomeTaskView } from "../../components/HomeTaskView";
import { ActionDto } from "@alliance/shared/client";
import { actionsFindAll } from "@alliance/shared/client";
import { client } from "@alliance/shared/client/client.gen";
import { useAuth } from "../../lib/AuthContext";

const todoItems = [
  {
    id: 1,
    title: "Boycott Lorem Inc.",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque vitae neque leo. Aliquam interdum pretium quam vitae auctor. Phasellus blandit aliquam magna vel congue.",
    category: "Climate",
    actions: [
      ActionCardAction.Discuss,
      ActionCardAction.Details,
      ActionCardAction.Complete,
    ],
  },
  {
    id: 2,
    title: "Call your senator to stop the loreming of ipsums",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusm tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusm tempor incididunt ut labore et dolore magna aliqua.",
    category: "Tech Safety",
    actions: [ActionCardAction.Discuss, ActionCardAction.Details],
  },
];

const HomePage: React.FC = () => {
  const [todoActions, setTodoActions] = useState<ActionDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return; // wait until auth bootstrap finished
    client.setConfig({
      baseUrl: "http://localhost:3005",
      credentials: "include",
    });
    actionsFindAll()
      .then(({ data }) => setTodoActions(data || []))
      .catch(() => setError("Failed to load actions"))
      .finally(() => setLoading(false));
  }, [authLoading]);

  return (
    <div className="flex flex-col w-full h-full items-center bg-white">
      <div className="flex flex-col py-12 max-w-[600px] gap-y-5 overflow-y-auto">
        <div className="flex flex-row items-center gap-x-2 justify-between w-full">
          <h1
            className="text-[#111] !text-[16pt] font-font"
            style={{
              fontWeight: "1000 !important",
            }}
          >
            Your Tasks
          </h1>
          <Button
            color={ButtonColor.Light}
            label="View All"
            onClick={() => {}}
          />
        </div>
        {error && <p className="text-red-500">{error}</p>}
        <HomeTaskView actions={todoActions} />
        <div className="flex flex-row items-center gap-x-2 justify-between w-full mt-5">
          <h1
            className="text-[#111] !text-[16pt] font-font"
            style={{
              fontWeight: "1000 !important",
            }}
          >
            New Actions
          </h1>
          <Button
            color={ButtonColor.Light}
            label="View All"
            onClick={() => {}}
          />
        </div>
        <ActionPromptCard
          id="1"
          title="Boycotting Lorem Inc."
          description="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque vitae neque leo. Aliquam interdum pretium quam vitae auctor. Phasellus blandit aliquam magna vel congue."
          category="Climate"
        />
        {todoItems.map((item) => (
          <ActionItemCard
            key={item.id}
            title={item.title}
            description={item.description}
            category={item.category}
            actions={item.actions}
          />
        ))}
      </div>
    </div>
  );
};

export default HomePage;
