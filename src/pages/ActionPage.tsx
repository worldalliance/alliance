import Navbar from "../components/Navbar";
import { NavbarPage } from "../components/Navbar";
import { useParams } from "react-router-dom";
import Card, { CardStyle } from "../components/system/Card";
import StatsCard from "../components/StatsCard";
import ActivityPanel from "../components/ActivityPanel";
import Globe from "../components/Globe";
import UserBubbleRow from "../components/UserBubbleRow";
import Button from "../components/system/Button";

const ActionPage: React.FC = () => {
  const { action } = useParams();

  return (
    <div className="flex flex-row min-h-screen pt-[100px] w-full justify-center gap-x-7 bg-stone-50">
      <div className="flex flex-col max-w-[700px] gap-y-3 border-r border-gray-200 pr-7">
        <h1 className="font-berlingske text-[28pt] pb-5">
          Lorem Ipsum Initiative
        </h1>
        <Card style={CardStyle.White}>
          <h1>Why?</h1>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </p>
        </Card>
        <Card>
          <h1>What you can do</h1>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem
            ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
            tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum
            dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua.
          </p>
        </Card>
        <Card>
          <h1>FAQ</h1>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </p>
        </Card>
        <div className="self-center pt-4">
          <Button label="Commit to this action" onClick={() => {}} />
        </div>
      </div>
      <div className="flex flex-col gap-y-5 items-stretch max-w-[300px]">
        <div className="w-[75 self-center">
          <Globe people={2300} />
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
