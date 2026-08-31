import { HowItWorks } from "./HowItWorks";
import { IntroVideo } from "./IntroVideo";
import { ModelSection } from "./ModelSection";
import { Priorities } from "./Priorities";
import { Testimonial } from "./Testimonial";

export function LandingBody() {
  return (
    <>
      <Priorities />
      <HowItWorks />
      <ModelSection />
      <Testimonial />
      <IntroVideo />
    </>
  );
}
