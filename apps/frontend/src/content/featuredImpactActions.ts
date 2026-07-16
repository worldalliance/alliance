export type FeaturedImpactAction = {
  actionId: number;
  emphasis: string;
  rest: string;
  imageSrc?: string;
  imageAlt?: string;
};

export const FEATURED_IMPACT_ACTIONS: readonly FeaturedImpactAction[] = [
  {
    actionId: 122,
    emphasis: "We ran a global behavioral study on eating less meat",
    rest: "with 274 member and non-member participants.",
  },
  {
    actionId: 130,
    emphasis:
      "We helped 77% of members bring their privacy in line with their preferences",
    rest: "by explaining why and how to adjust their Meta privacy settings.",
  },
  {
    actionId: 84,
    emphasis: "We raised $2,702 for Helen Keller International",
    rest: "by making small adjustments to our personal spending habits.",
  },
  {
    actionId: 75,
    emphasis: "We submitted 3 formal comments",
    rest: "on U.S. federal AI policy dockets, informed by member and expert opinions.",
  },
  {
    actionId: 56,
    emphasis: "We showed that AI companies violate privacy expectations",
    rest: "by running a small experiment with friends and family.",
  },
  {
    actionId: 14,
    emphasis:
      "We caused 11 cafe locations to adopt bring-your-own-cup policies",
    rest: "by helping them attain media recognition.",
    imageSrc: "https://worldalliance.org/api/images/1759964091349.webp",
  },
  {
    actionId: 91,
    emphasis: "We submitted public records requests to 100+ California cities",
    rest: "to build a statewide map of police AI usage.",
  },
  {
    actionId: 76,
    emphasis: "We held a discussion with current and former US EPA employees",
    rest: "about the repeal of the EPA's endangerment finding.",
  },
  {
    actionId: 95,
    emphasis:
      "We helped a small electronics company replace two components with environmentally friendly alternatives",
    rest: "in exchange for feedback on their product.",
  },
  {
    actionId: 86,
    emphasis: "We donated $912 to GiveDirectly",
    rest: "by collecting unclaimed property from our governments.",
  },
  {
    actionId: 62,
    emphasis: "We held a discussion with experts on global cooperation",
    rest: "about the US withdrawal from several international institutions.",
  },
  {
    actionId: 64,
    emphasis: "We collected and recycled 57 kg (126 lbs) of e-waste",
    rest: "from around our own homes.",
    imageSrc: "https://dj92mxbdjuclo.cloudfront.net/1768418139810.webp",
  },
  {
    actionId: 49,
    emphasis: "We sent $600 to Cool Earth and $400 to GiveDirectly",
    rest: "by voting on ways to use $1,000 gifted to us by a one-time partner donor.",
  },
  {
    actionId: 32,
    emphasis:
      "We compiled suggestions to help 3 non-profits increase their donations",
    rest: "by answering a series of questions about their websites.",
  },
  {
    actionId: 81,
    emphasis: "3 restaurants switched to only providing utensils on request",
    rest: "after we emailed local restaurants who previously offered utensils by default.",
  },
  {
    actionId: 54,
    emphasis: "We submitted 27 well-researched comments",
    rest: "to our representatives by identifying local issues relevant to Alliance priorities.",
  },
  {
    actionId: 50,
    emphasis: "We filled up to 20 potholes",
    rest: "by reporting them to our local governments.",
    imageSrc: "https://worldalliance.org/api/images/1762827853197.webp",
  },
] as const;
