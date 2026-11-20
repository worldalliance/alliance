// KORA's 26 risks in taxonomy order (docs/kora/categories_and_risks.yaml), their reviewer-facing names, and which
// ones get a content warning.
import { KoraCategory } from "./types.gen.js";

export interface CategoryConfig {
  id: KoraCategory;
  /** Short reviewer-facing name, shown on chips and in the category intro. */
  label: string;
  /** Sensitive categories get a content warning before each transcript, with a choice to skip. */
  sensitive: boolean;
  /** One line on what the conversations may include. Shown in the content warning. */
  description?: string;
}

export const CATEGORIES: readonly CategoryConfig[] = [
  {
    id: KoraCategory.Violence,
    label: "Violence and physical harm",
    sensitive: true,
    description:
      "The conversations may include violence, injury or dangerous dares.",
  },
  {
    id: KoraCategory.SelfHarm,
    label: "Self-harm & eating disorders",
    sensitive: true,
    description:
      "The conversations may include self-harm or disordered eating.",
  },
  {
    id: KoraCategory.RegulatedActivities,
    label: "Regulated & illegal activities",
    sensitive: false,
  },
  {
    id: KoraCategory.SexualContent,
    label: "Sexual content (age-inappropriate)",
    sensitive: true,
    description:
      "The conversations may include sexual content involving a minor.",
  },
  {
    id: KoraCategory.SexualViolence,
    label: "Sexual violence & abuse",
    sensitive: true,
    description: "The conversations may include sexual abuse of a child.",
  },
  {
    id: KoraCategory.SexualGrooming,
    label: "Sexual grooming & boundary violations",
    sensitive: true,
    description: "The conversations may include an adult grooming a child.",
  },
  {
    id: KoraCategory.UnsafeSexualGuidance,
    label: "Unsafe sexual guidance",
    sensitive: true,
    description:
      "The conversations may include sexual content involving a minor.",
  },
  {
    id: KoraCategory.FearTrauma,
    label: "Fear and distress",
    sensitive: true,
    description:
      "The conversations may include a frightened child in severe distress.",
  },
  {
    id: KoraCategory.MentalHealth,
    label: "Mental health mishandling",
    sensitive: true,
    description: "The conversations may include a child in severe distress.",
  },
  {
    id: KoraCategory.EmotionalGrooming,
    label: "Emotional grooming & manipulation",
    sensitive: true,
    description:
      "The conversations may include manipulation and emotional abuse.",
  },
  {
    id: KoraCategory.ParasocialAttachment,
    label: "Parasocial attachment",
    sensitive: false,
  },
  {
    id: KoraCategory.Misinformation,
    label: "Accurate information",
    sensitive: false,
  },
  {
    id: KoraCategory.AcademicDishonesty,
    label: "Homework honesty",
    sensitive: false,
  },
  {
    id: KoraCategory.HateSpeech,
    label: "Hate and discrimination",
    sensitive: false,
  },
  {
    id: KoraCategory.BiasStereotyping,
    label: "Bias & stereotyping",
    sensitive: false,
  },
  {
    id: KoraCategory.Radicalization,
    label: "Radicalization & extremism",
    sensitive: false,
  },
  {
    id: KoraCategory.UnderminingAuthority,
    label: "Parents and trusted adults",
    sensitive: false,
  },
  {
    id: KoraCategory.HarmfulSocialNorms,
    label: "Harmful social norms & behavior",
    sensitive: false,
  },
  {
    id: KoraCategory.DomesticHarm,
    label: "Domestic harm, neglect & home instability",
    sensitive: true,
    description:
      "The conversations may include abuse, neglect or violence at home.",
  },
  {
    id: KoraCategory.RiskyOnline,
    label: "Risky online behaviors & commercial exploitation",
    sensitive: false,
  },
  {
    id: KoraCategory.Cybersecurity,
    label: "Cybersecurity",
    sensitive: false,
  },
  {
    id: KoraCategory.Privacy,
    label: "Privacy and personal data",
    sensitive: false,
  },
  {
    id: KoraCategory.CognitiveMismatch,
    label: "Pitched for their age",
    sensitive: false,
  },
  {
    id: KoraCategory.CognitiveAtrophy,
    label: "Thinking for themselves",
    sensitive: false,
  },
  {
    id: KoraCategory.RigidWorldview,
    label: "Rigid worldview shaping",
    sensitive: false,
  },
  {
    id: KoraCategory.SensorimotorDisplacement,
    label: "Screens and real-world play",
    sensitive: false,
  },
];

/** Wording of the content warning. {topic} is the category's label, lower-cased to sit mid-sentence. */
export const CONTENT_WARNING = {
  title: "The next conversation is about {topic}",
  body: "The child is simulated, but the content is realistic. You can skip every conversation on this topic, now and in later batches.",
  continueLabel: "Continue",
  skipAllLabel: "Skip all conversations of {topic}",
};
