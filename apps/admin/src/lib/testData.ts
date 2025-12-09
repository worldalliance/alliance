import { CreateActionDto, UserDto } from "@alliance/shared/client";

export const FORM_BUILDER_PREVIEW_USER: UserDto = {
  id: 0,
  name: "Preview User",
  emailNotifsEnabled: false,
  textNotifsEnabled: false,
  pushNotifsEnabled: false,
  socialNotifsPreference: "none",
  turnedOffAllNotifs: false,
  forumDigestPreference: "off",
  admin: false,
  staff: false,
  shareEmailWithCommunityLead: true,
  sharePhoneNumberWithCommunityLead: true,
  preferredActionReminderChannel: "text",
  profilePicture: null,
  communities: [],
  formDataPreference: "public",
  invitedCommunities: [],
  hasActiveContract: true,
  referralCode: null,
  onboardingComplete: true,
  anonymous: false,
  email: "preview@example.com",
  contractEvents: [
    {
      type: "signed",
      date: new Date().toISOString(),
      automatic: false,
    },
  ],
};

export const testActions: CreateActionDto[] = [
  // Funding Action 1
  {
    name: "Save 2,500 acres of Ecuador cloud forest",
    category: "Climate Change",
    body: `Protect Ecuador's Biodiversity Hotspot

## The Crisis
Gold mining companies are expressing interest in a highly biodiverse area of Ecuador's cloud forest. This pristine ecosystem is home to countless species of plants, animals, and insects found nowhere else on Earth.

## Our Solution
We can outpace these mining companies by purchasing the land directly and placing it under permanent protection. Every dollar donated goes directly toward land acquisition and legal protection.

## Impact
- **2,500 acres** of pristine cloud forest protected
- **Hundreds of species** safeguarded from extinction
- **Carbon sequestration** equivalent to taking 1,000 cars off the road
- **Indigenous rights** protected and respected

## How It Works
1. We identify critical parcels of land under threat
2. Local partners negotiate with landowners
3. Legal protections are put in place
4. Long-term stewardship is established

This is our chance to take direct action against environmental destruction. Every contribution makes a difference.`,
    shortDescription:
      "Gold mining companies are expressing interest in a highly biodiverse area. We can outpace them by purchasing the land.",
    type: "Funding",
    commitmentThreshold: 100,
    donationAmount: 1000,
    timeEstimate: 5,
    commitmentless: false,
    participatingTags: [],
    useManualCohort: false,
    everyoneShouldComplete: false,
    priority: 0,
    preventCompletion: false,
  },
  {
    name: "Use public transportation instead of driving",
    category: "Climate Change",
    body: `Transform Your Daily Commute

## The Transportation Crisis
Transportation accounts for **28% of US greenhouse gas emissions**, with personal vehicles being the largest contributor. The average American car emits **4.6 tons of CO2** annually.

## The Public Transit Solution
Public transportation is:
- **45% more fuel efficient** than private vehicles
- **Reduces CO2 emissions** by 37 million tons annually
- **Saves individuals** an average of $10,000 per year
- **Reduces traffic congestion** for everyone

## Health Benefits
Regular public transit use means:
- **More walking** to and from stations
- **Reduced stress** from driving in traffic
- **Better air quality** in communities
- **Lower accident risk** compared to driving

## Economic Impact
When you use public transit:
- **$10,000+ saved** annually on car expenses
- **Local economy boosted** through transit-oriented development
- **Job creation** in the transit sector
- **Reduced infrastructure costs** for road maintenance

## Building Better Communities
Public transit creates:
- **More walkable neighborhoods**
- **Increased property values** near transit stations
- **Greater social equity** in transportation access
- **Reduced urban sprawl**

## Overcoming Common Concerns
- **"It takes too long"** - Use travel time for reading, work, or relaxation
- **"It's unreliable"** - Most systems have real-time tracking apps
- **"It's uncomfortable"** - Bring headphones, books, or work to do
- **"It's not convenient"** - Plan routes in advance and build habits

Your commitment to public transit is an investment in a sustainable future.`,
    shortDescription:
      "Reduce your carbon footprint by using public transportation for daily commutes.",
    type: "Ongoing",

    commitmentThreshold: 150,
    commitmentless: false,
    participatingTags: [],
    useManualCohort: false,
    everyoneShouldComplete: false,
    priority: 0,
    preventCompletion: false,
  },
];
