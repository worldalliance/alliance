import { CitySearchDto, userOnboarding } from "@alliance/shared/client";
import CityAutosuggest from "../../components/CityAutosuggest";
import Button, { ButtonColor } from "../../components/system/Button";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router";

const OnboardingPage: React.FC = () => {
  const [isOver18, setIsOver18] = useState<boolean | null>(null);
  const [makesMoney, setMakesMoney] = useState<boolean | null>(null);
  const [city, setCity] = useState<number | null>(null);
  const [anonymous, setAnonymous] = useState<boolean | null>(null);

  const navigate = useNavigate();

  const handleSubmit = async () => {
    const response = await userOnboarding({
      body: {
        cityId: city,
        over18: isOver18,
        anonymous: anonymous ?? false,
      },
    });
    if (response.response.ok) {
      navigate("/home");
      window.location.reload(); //TODO: fix state reload
    }
  };

  const handleCitySelect = useCallback(
    (city: CitySearchDto) => {
      setCity(city.id);
    },
    [setCity]
  );

  return (
    <div className="container flex flex-col justify-center h-screen min-w-[400px] max-w-[600px] justify-self-center gap-y-2 px-3">
      <p className="font-bold text-lg">Welcome to the Alliance! </p>
      <p className="!mb-5">
        We&apos;re going to have a bit of onboarding text here. Maybe some
        instructions on what to do, links to informational material, or other
        stuff like that. We also have a couple questions before you can get
        started, if thats okay with you.
      </p>
      <p className="font-bold">Whereabouts do you live?</p>
      <CityAutosuggest onSelect={handleCitySelect} placeholder="Enter a city" />
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
      {/* <p className="mt-5 font-bold">
        Would you like to participate anonymously?
      </p>
      <div className="flex flex-row gap-x-2">
        <Button
          color={anonymous === true ? ButtonColor.Blue : ButtonColor.Light}
          onClick={() => setAnonymous(true)}
        >
          Yes
        </Button>
        <Button
          color={anonymous === false ? ButtonColor.Blue : ButtonColor.Light}
          onClick={() => setAnonymous(false)}
        >
          No
        </Button>
      </div> */}
      {/* <p className="mt-5 font-bold">Do you make a lot of money?</p>
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
      </div> */}
      <div className="flex flex-row gap-x-2 mt-2">
        <Button
          color={ButtonColor.Green}
          onClick={handleSubmit}
          className="mt-5 self-center"
        >
          Get Started
        </Button>
      </div>
    </div>
  );
};

export default OnboardingPage;
