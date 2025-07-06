import React from "react";
import Footer from "../../components/Footer";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import Expandable from "../../components/Expandable";
import MarkdownWrapper from "../../components/MarkdownWrapper";
import ExampleActionCategoryCard from "../../components/ExampleActionCategoryCard";

const GuidePage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="flex-1 container mx-auto pt-20 md:pt-36 pb-56 flex flex-col px-5">
        <div className="flex flex-col">
          <h2 className="mx-auto !font-sabon !font-semibold !text-4xl md:!text-5xl text-center mb-4 max-w-3xl">
            Guide to the Alliance
          </h2>

          <MarkdownWrapper
            markdownContent="

The Alliance is a global group of people that abide by a process which governs the use of our collective power. We seek to unite millions to billions of people into one cooperative force that represents humanity's collective interests.

Our mission is to build a civilization that serves all individuals in their pursuit of life, liberty, and happiness – a world in which we can take pride. Most pressingly, we seek to resolve ongoing global crises, which include environmental destruction, extreme poverty, democratic dysfunction, and unsafe technological development.

Our key strength is our structure, which makes our collective action strategic and sustained.
1. **Membership is commitment-based.** We each dependably make a small amount of our time and resources available to the Alliance.
2. **Strategy is centralized.** We are served by a strategic office that uses data and expertise to plan and optimize collective actions that reflect our common interests.

As a result of our structure, the people are endowed with the same cooperative power that makes corporations, unions, governments, and other formal organizations highly effective. We can coordinate in novel, flexible, and complex ways. We can plan in advance, wield verifiable leverage, act proactively rather than reactively, and learn from experience.

The possibilities for collective action are endless. A few broad categories of actions we can take together include:

"
          />

          <div className="grid grid-cols-3 gap-4 mt-10 w-full max-w-6xl mx-auto">
            <ExampleActionCategoryCard
              title="Collective funding"
              description="We pool funding for specific initiatives and projects within the Alliance and with our partners."
            />
            <ExampleActionCategoryCard
              title="Economic pressure"
              description="We coordinate shifts in our consumer behavior to encourage ethical practices and discourage harmful practices."
            />
            <ExampleActionCategoryCard
              title="Social pressure"
              description="We target messages at decision-makers and direct public attention to important issues."
            />
            <ExampleActionCategoryCard
              title="Synced communication"
              description="We learn from and deliberate with one another through a central channel that builds a base of common knowledge."
            />
            <ExampleActionCategoryCard
              title="Community support"
              description="We share what resources we can to help one another in our personal and professional lives."
            />
            <ExampleActionCategoryCard
              title="Collective governance"
              description="We maintain and improve the Alliance by participating in polls, feedback, and other internal processes."
            />
          </div>
        </div>
        <div className="w-full max-w-3xl mx-auto flex flex-col gap-y-8 mt-10">
          <Expandable title="Principles">
            <div className="flex flex-col gap-y-5">
              <MarkdownWrapper
                markdownContent="

## Context

As a global polity of individuals who each have their own perspectives and beliefs, the only official stance of the Alliance, and the only belief required to be a member, is that humanity must cooperate to advance its collective interests.

The Alliance is more like a country than a political party: it has no platform separable from the wants and needs of humanity. Its base of positions, plans, and policies will develop according to a process that we (the Strategic Office) have designed to strike a balance between moral reasoning, democratic input, and pragmatic considerations.

## Vision

It is the broadest aim of the Alliance to free individuals from servitude to civilization and build a civilization whose chief purpose is to serve individuals in their pursuit of fulfillment and happiness. This means that every individual has equal opportunity, people work as much as is necessary to meet the basic needs of all, the planet begins to heal, the most important facets of life are determined democratically, and there is no threat from political or economic instability.

Over the next few decades, the Alliance aims to comprehensively resolve – not marginally improve, but end in their entirety – ongoing global crises, which include environmental destruction, extreme poverty, democratic dysfunction, and unsafe technological development.

We do not pursue any particular realization of this world, such as via a unitary state. The future must be democratically determined and will take decades to build. We treat diverging perspectives on solutions as beliefs that can and must be resolved with deliberation and education.

As far as it must affect our foreseeable strategy, however, we believe that:
1. It will be necessary to change specific economic incentives. Our current global economic system is the source of many harms: for example, the quasi-enslavement of workers in poor countries to support luxurious lifestyles elsewhere, constant threat of unemployment, loss of meaning, enormously wasteful industries, and the undemocratic treatment of crucial facets of life at local and global levels, including the availability of public spaces and services, the philosophy of education, the independence of the press, and the health of our planet.
2. It is not feasible to abandon capitalism in one fell swoop. The Alliance will evaluate morally, democratically, and scientifically which facets of the global economy require and are conducive to change and improve them one by one.
3. The Alliance is an opportunity for those who advocate for socialist policy to prove that they can voluntarily and reliably cooperate to better the collective, even when it does not immediately benefit themselves. Many worry that the cooperation required by socialism either requires freedom-depriving enforcement or is susceptible to free-riders. These worries can be proven or disproven by the Alliance, which provides much of the infrastructure required to accomplish socialist aims, but lacks freedom-depriving enforcement mechanisms.

## Moral reasoning

Morality is our central consideration in decisions and priority-setting.

In assessment of morality, we hew to a single principle that nearly all cultures share: that one should treat others as one would want to be treated by them. As the “ethics of reciprocity,” this principle is unbiased and universal.

As a civilizational ideal, this principle would have that everyone is free to do anything except to impose unwanted influences on others.

We will make tradeoffs and determine priorities to best satisfy this ideal. In other words, we will use science (e.g., climate science predicting impacts) and democratic input (e.g., internal and external surveys) to evaluate the extent to which a decision affects a party’s freedoms and the extent to which those freedoms affect other parties against their will.

The details of the correct balance of freedoms and protections are difficult to determine. Today, however, many global crises violate this civilizational ideal egregiously by imposing massive harms on billions of current and future people.

## Democratic input

We plan actions at the intersection of:
1. The clear collective interests of humanity, as we can ascertain using global preference data and the aforementioned moral reasoning.
2. The specific collective interests of members, as we can ascertain through internal democratic processes.

We expect nearly complete overlap between these two categories. However, we will not pursue specific member interests that we perceive to negatively impact humanity at large, and we will not pursue general human interests to which a majority of members are opposed. 

Actions that advance member interests will not necessarily be the most effective ways to do good for all of humanity. This is fair because members deserve to see personal rewards for their efforts. This is also practical because we can and will obtain high-quality data on members’ preferences by running polls and deliberations, soliciting proposals, and so on.

We will adjust in response to feedback such that our broad portfolio of actions is approved by all members.

## Pragmatic considerations

The urgency of the crises of our era demands imperfect solutions. We will prioritize some problems and neglect others on the basis of their scale, tractability, and time-sensitivity. In the course of political and economic change, various parties will be harmed that do not or cannot consent to harm. Need for swift action will preclude that every decision is subject to extensive democratic consultation.

We accept the inevitability of imperfections and will seek to minimize their harm.

              "
              />
            </div>
          </Expandable>

          <Expandable title="What does it mean to be a member?">
            <div className="flex flex-col gap-y-5">
              <MarkdownWrapper
                markdownContent="
              
## Overview
Alliance members are individuals that have committed to cooperate with one another to build a better future for all.

The Alliance embodies the most general form of cooperation it can accommodate: not a cooperation for any specific operation or with any specific tactics, but a cooperation to figure out how to do better for humanity and then make it happen, together.

Therefore, membership is an agreement to abide by a general process that governs how the Alliance uses its collective power. This process is embodied by the Alliance Strategic Office, which plans collective actions according to need and ability, and requires that members dependably engage with actions assigned to them.

## Required Investment            
The Office will limit the total time and resources required by members to *below 1 hour/month* and *$10/month*.

Once membership reaches a critical size, the Office will democratically determine time and resource commitments for different cohorts of members.

## Example Actions
The Office will break every required action into easy-to-follow steps.

Early members will participate in experiments and other work to help shape the Alliance. For instance:
- Providing feedback on website copy.
- Introducing the Office to prospective Alliance members.
- Testing the Alliance online platform.
- Testing deliberation methods for determining Alliance priorities.
- Participating in small-scale donation-pooling experiments.

## Dependability
Member dependability is a cornerstone of Alliance strategy. Dependability allows the Office to plan in advance, learn from mistakes, wield verifiable leverage, respond rapidly to events, and create complex action plans that go far beyond petitions, untargeted boycotts, and other standard mass actions.

Therefore, *you are expected to engage with every action for which the Office determines you are needed*. Engaging with an action means:
1. Participating in the action, or
2. Telling the Office why you cannot take the action, or
3. Telling the Office why you find the action morally reprehensible (not mildly disagree with or fail to understand).

You are not expected to participate in every action, but you are expected to either participate or provide feedback to help the Office produce a portfolio of actions that all members find acceptable.

## Persistence through Disagreement
Cooperation is not about attaining some idealistic harmony: it is about working through disagreement and other conflicts in order to reach a common goal. It is impossible to create a future that is perfect from the perspective of every individual; our common goal is rather to create a future that all members agree is better than the future that would occur otherwise.

That means that the success of the Alliance depends on member commitment to the general process that governs the use of its collective power, and not to any particular collective action. Similarly, a lawful society depends on citizens following every democratically determined law, not only the laws they agree with. 

If members only participate in actions they agree with, the Alliance will always have to satisfy the lowest common denominator. This selective participation will make it much more difficult to make progress, or result in a homogenous Alliance composed of members with exactly the same perspectives.

That means *you are expected to participate in actions you may not perfectly understand or agree with*. In return, other members will participate in actions that you care about even if they do not understand or agree.

The Alliance’s overall portfolio of actions will be democratically determined such that in practice, all members will agree that most actions are beneficial. The Office will build this portfolio around member values and feedback, balance actions across member interests, and conduct polls and host deliberations in advance of actions that it expects to be controversial.

            "
              />
            </div>
          </Expandable>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default GuidePage;
