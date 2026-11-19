// KORA's 26 risks in taxonomy order (docs/kora/categories_and_risks.yaml), their reviewer-facing names, and which
// ones get a content warning.
import { KoraCategory } from "./types.gen.js";

export enum RiskGroup {
  PhysicalAndLegalSafety = "physical_and_legal_safety",
  SexualContentAndExploitation = "sexual_content_exploitation_and_predation",
  PsychologicalAndEmotionalSafety = "psychological_and_emotional_safety",
  EducationalAndEpistemicIntegrity = "educational_and_epistemic_integrity",
  BiasHateAndSocietalHarm = "bias_hate_and_societal_harm",
  SocialFamilyAndBehavioralInfluence = "social_family_and_behavioral_influence",
  OnlineSafety = "online_safety",
  DevelopmentalRisk = "developmental_risk",
}

/** The 8 categories the 26 risks sit under, named for reviewers rather than in the taxonomy's title case. */
export const RISK_GROUP_NAMES: Record<RiskGroup, string> = {
  [RiskGroup.PhysicalAndLegalSafety]: "Physical and legal safety",
  [RiskGroup.SexualContentAndExploitation]:
    "Sexual content, exploitation and predation",
  [RiskGroup.PsychologicalAndEmotionalSafety]:
    "Psychological and emotional safety",
  [RiskGroup.EducationalAndEpistemicIntegrity]:
    "Educational and epistemic integrity",
  [RiskGroup.BiasHateAndSocietalHarm]: "Bias, hate and societal harm",
  [RiskGroup.SocialFamilyAndBehavioralInfluence]:
    "Social, family and behavioral influence",
  [RiskGroup.OnlineSafety]: "Online safety",
  [RiskGroup.DevelopmentalRisk]: "Developmental risk",
};

export interface CategoryConfig {
  id: KoraCategory;
  /** Short reviewer-facing name, shown on chips and in the category intro. */
  label: string;
  /** The category this risk sits under; the opt-out screen groups by it. */
  group: RiskGroup;
  /** Sensitive categories get a content warning before each transcript, with a choice to skip. */
  sensitive: boolean;
  /** One line on what the conversations may include. Shown in the content warning. */
  description?: string;
}

export const CATEGORIES: readonly CategoryConfig[] = [
  {
    id: KoraCategory.Violence,
    group: RiskGroup.PhysicalAndLegalSafety,
    label: "Violence and physical harm",
    sensitive: true,
    description:
      "The conversations may include violence, injury or dangerous dares.",
  },
  {
    id: KoraCategory.SelfHarm,
    group: RiskGroup.PhysicalAndLegalSafety,
    label: "Self-harm & eating disorders",
    sensitive: true,
    description:
      "The conversations may include self-harm or disordered eating.",
  },
  {
    id: KoraCategory.RegulatedActivities,
    group: RiskGroup.PhysicalAndLegalSafety,
    label: "Regulated & illegal activities",
    sensitive: false,
  },
  {
    id: KoraCategory.SexualContent,
    group: RiskGroup.SexualContentAndExploitation,
    label: "Sexual content (age-inappropriate)",
    sensitive: true,
    description:
      "The conversations may include sexual content involving a minor.",
  },
  {
    id: KoraCategory.SexualViolence,
    group: RiskGroup.SexualContentAndExploitation,
    label: "Sexual violence & abuse",
    sensitive: true,
    description: "The conversations may include sexual abuse of a child.",
  },
  {
    id: KoraCategory.SexualGrooming,
    group: RiskGroup.SexualContentAndExploitation,
    label: "Sexual grooming & boundary violations",
    sensitive: true,
    description: "The conversations may include an adult grooming a child.",
  },
  {
    id: KoraCategory.UnsafeSexualGuidance,
    group: RiskGroup.SexualContentAndExploitation,
    label: "Unsafe sexual guidance",
    sensitive: true,
    description:
      "The conversations may include sexual content involving a minor.",
  },
  {
    id: KoraCategory.FearTrauma,
    group: RiskGroup.PsychologicalAndEmotionalSafety,
    label: "Fear and distress",
    sensitive: true,
    description:
      "The conversations may include a frightened child in severe distress.",
  },
  {
    id: KoraCategory.MentalHealth,
    group: RiskGroup.PsychologicalAndEmotionalSafety,
    label: "Mental health mishandling",
    sensitive: true,
    description: "The conversations may include a child in severe distress.",
  },
  {
    id: KoraCategory.EmotionalGrooming,
    group: RiskGroup.PsychologicalAndEmotionalSafety,
    label: "Emotional grooming & manipulation",
    sensitive: true,
    description:
      "The conversations may include manipulation and emotional abuse.",
  },
  {
    id: KoraCategory.ParasocialAttachment,
    group: RiskGroup.PsychologicalAndEmotionalSafety,
    label: "Parasocial attachment",
    sensitive: false,
  },
  {
    id: KoraCategory.Misinformation,
    group: RiskGroup.EducationalAndEpistemicIntegrity,
    label: "Accurate information",
    sensitive: false,
  },
  {
    id: KoraCategory.AcademicDishonesty,
    group: RiskGroup.EducationalAndEpistemicIntegrity,
    label: "Homework honesty",
    sensitive: false,
  },
  {
    id: KoraCategory.HateSpeech,
    group: RiskGroup.BiasHateAndSocietalHarm,
    label: "Hate and discrimination",
    sensitive: false,
  },
  {
    id: KoraCategory.BiasStereotyping,
    group: RiskGroup.BiasHateAndSocietalHarm,
    label: "Bias & stereotyping",
    sensitive: false,
  },
  {
    id: KoraCategory.Radicalization,
    group: RiskGroup.BiasHateAndSocietalHarm,
    label: "Radicalization & extremism",
    sensitive: false,
  },
  {
    id: KoraCategory.UnderminingAuthority,
    group: RiskGroup.SocialFamilyAndBehavioralInfluence,
    label: "Parents and trusted adults",
    sensitive: false,
  },
  {
    id: KoraCategory.HarmfulSocialNorms,
    group: RiskGroup.SocialFamilyAndBehavioralInfluence,
    label: "Harmful social norms & behavior",
    sensitive: false,
  },
  {
    id: KoraCategory.DomesticHarm,
    group: RiskGroup.SocialFamilyAndBehavioralInfluence,
    label: "Domestic harm, neglect & home instability",
    sensitive: true,
    description:
      "The conversations may include abuse, neglect or violence at home.",
  },
  {
    id: KoraCategory.RiskyOnline,
    group: RiskGroup.OnlineSafety,
    label: "Risky online behaviors & commercial exploitation",
    sensitive: false,
  },
  {
    id: KoraCategory.Cybersecurity,
    group: RiskGroup.OnlineSafety,
    label: "Cybersecurity",
    sensitive: false,
  },
  {
    id: KoraCategory.Privacy,
    group: RiskGroup.OnlineSafety,
    label: "Privacy and personal data",
    sensitive: false,
  },
  {
    id: KoraCategory.CognitiveMismatch,
    group: RiskGroup.DevelopmentalRisk,
    label: "Pitched for their age",
    sensitive: false,
  },
  {
    id: KoraCategory.CognitiveAtrophy,
    group: RiskGroup.DevelopmentalRisk,
    label: "Thinking for themselves",
    sensitive: false,
  },
  {
    id: KoraCategory.RigidWorldview,
    group: RiskGroup.DevelopmentalRisk,
    label: "Rigid worldview shaping",
    sensitive: false,
  },
  {
    id: KoraCategory.SensorimotorDisplacement,
    group: RiskGroup.DevelopmentalRisk,
    label: "Screens and real-world play",
    sensitive: false,
  },
];
