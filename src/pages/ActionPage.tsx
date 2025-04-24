import Navbar from "../components/Navbar";
import { NavbarPage } from "../components/Navbar";
import { useNavigate, useParams } from "react-router-dom";
import Card, { CardStyle } from "../components/system/Card";
import StatsCard from "../components/StatsCard";
import ActivityPanel from "../components/ActivityPanel";
import Globe from "../components/Globe";
import UserBubbleRow from "../components/UserBubbleRow";
import Button, { ButtonColor } from "../components/system/Button";
import PokePanel from "../components/PokePanel";

export interface ActionState {
  state: "uncommitted" | "committed" | "completed";
}

const ActionPage: React.FC<ActionState> = ({ state }) => {
  const { action } = useParams();
  const navigate = useNavigate();

  return (
    <div className="flex flex-row min-h-screen pt-[100px] w-full justify-center gap-x-7 bg-stone-50">
      <div className="flex flex-col max-w-[700px] gap-y-3 border-r border-gray-200 pr-7">
        <div className="flex flex-row justify-between items-center">
          <h1 className="font-berlingske text-[28pt]">
            Lorem Ipsum Initiative
          </h1>
          {state === "uncommitted" && (
            <Button
              className="mt-1"
              label="Commit to this action"
              onClick={() => {}}
            />
          )}
        </div>
        <p className="text-gray-900 text-[12pt] mt-[-3px] mb-5">
          Part of the{" "}
          <a
            className="text-blue-500 cursor-pointer"
            onClick={() => {
              navigate("/issues/climate");
            }}
          >
            Alliance Climate Program
          </a>
        </p>
        {state === "committed" && <PokePanel />}
        {state === "uncommitted" && (
          <Card style={CardStyle.Grey} className="mb-5">
            <h1>Why Join?</h1>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua.
            </p>
          </Card>
        )}
        <h1>What you can do</h1>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem
          ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
          tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor
          sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
          incididunt ut labore et dolore magna aliqua.
        </p>
        <h1>FAQ</h1>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua.
        </p>
        <h1>Discussion</h1>
        <Card style={CardStyle.White}>
          <p>Forum post lorem</p>
        </Card>
        <Card style={CardStyle.White}>
          <p>Forum post ipsum</p>
        </Card>
        <Card style={CardStyle.White}>
          <p>Forum post dolor sit amet</p>
        </Card>
      </div>
      <div className="flex flex-col gap-y-5 items-stretch max-w-[300px]">
        <div className="w-[75 self-center">
          <Globe people={23} colored />
          <p className="text-center pt-2 text-[11pt]">
            23,053 people committed
          </p>
        </div>

        <Card style={CardStyle.White} className="items-center">
          <UserBubbleRow />
          <p className="text-center pt-2 text-[11pt]">
            <b>6 friends</b> already joined this action!
          </p>
        </Card>
        <StatsCard />
      </div>
    </div>
  );
};

export default ActionPage;
