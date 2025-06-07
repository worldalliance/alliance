import CityAutosuggest from "../../components/CityAutosuggest";
import Button, { ButtonColor } from "../../components/system/Button";
import { useState } from "react";
const OnboardingPage: React.FC = () => {
  const [isOver18, setIsOver18] = useState<boolean | null>(null);
  const [makesMoney, setMakesMoney] = useState<boolean | null>(null);

  return (
    <div className="container flex flex-col justify-center h-screen min-w-[400px] max-w-[600px] justify-self-center gap-y-2">
      <p className="font-bold ">You&apos;re signed up! </p>
      <p className="mb-5">
        We just have a couple questions before you can get started, if thats
        okay with you.
      </p>
      <p className="font-bold">Whereabouts do you live?</p>
      <CityAutosuggest onSelect={() => {}} placeholder="Enter a city" />
      <p className="mt-5 font-bold">Are you above 18 years old?</p>
      <div className="flex flex-row gap-x-2">
        <Button
          color={isOver18 === true ? ButtonColor.Blue : ButtonColor.Light}
          onClick={() => setIsOver18(true)}
        >
          Yes
        </Button>
        <Button
          color={isOver18 === false ? ButtonColor.Blue : ButtonColor.Light}
          onClick={() => setIsOver18(false)}
        >
          No
        </Button>
      </div>
      <p className="mt-5 font-bold">Do you make lots of money?</p>
      <div className="flex flex-row gap-x-2">
        <Button
          color={makesMoney === true ? ButtonColor.Blue : ButtonColor.Light}
          onClick={() => setMakesMoney(true)}
        >
          Yes
        </Button>
        <Button
          color={makesMoney === false ? ButtonColor.Blue : ButtonColor.Light}
          onClick={() => setMakesMoney(false)}
        >
          No
        </Button>
      </div>
      <Button
        color={ButtonColor.Green}
        onClick={() => {}}
        className="mt-5 self-center"
      >
        Get Started
      </Button>
    </div>
  );
};

export default OnboardingPage;
