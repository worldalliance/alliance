import { StoryObj, Meta } from "@storybook/react";
import ActionPage from "../pages/app/ActionPage";
import {
  MemoryRouter,
  Route,
  Routes,
  UNSAFE_LocationContext,
} from "react-router-dom";

const meta = {
  title: "Alliance/ActionPage",
  component: ActionPage,
  tags: ["page"],
  parameters: {},
  args: {},
} satisfies Meta<typeof ActionPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    return (
      <UNSAFE_LocationContext.Provider value={null as unknown as never}>
        <MemoryRouter initialEntries={["/action/1"]}>
          <Routes>
            <Route path="/action/:id" element={<ActionPage />} />
          </Routes>
        </MemoryRouter>
      </UNSAFE_LocationContext.Provider>
    );
  },
};
