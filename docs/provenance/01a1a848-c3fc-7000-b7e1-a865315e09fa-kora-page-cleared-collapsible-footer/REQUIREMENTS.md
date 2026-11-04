---
user: Alex Dorey
task: In /projects/safer-chatbots-for-children, clear out the content and make the footer shrink to 12px but expandable with a click. Then build a light-mode dashboard for the KORA chatbot-safety project that introduces the project and cycles through the risk categories with what good and bad chatbot behavior looks like.
---

# Requirements

- `/projects/safer-chatbots-for-children` renders the site navbar, the review dashboard, and the site footer. The previous hero, KORA sign-in form, participant bar, About sections, timeline, facts, and news collage are removed. (agent-proposed, user-approved)
- On that page the footer is collapsed to a 12px-tall strip; clicking it expands the full footer. A lucide chevron shows that it toggles: up on the collapsed strip, down at the top of the expanded footer, where clicking collapses it again. (user-originated; collapsing again agent-proposed, implied by "toggleable")
- The collapsed footer applies to that page only; every other page using the site footer keeps the full footer. (agent-proposed, user-approved)

## Review dashboard

- Light mode. (user-originated)
- On this page the site navbar drops the People, Guide, Progress and Partner links, and with them the phone menu, which held nothing else; "The Alliance" logotype sits at the left, where "People" was, and Log In stays at the right. Other pages keep the full navbar. (user-originated; this-page-only and dropping the empty phone menu are agent decisions)
- The h1 reads "Thank you for joining the waitlist". Under it: "Our partner, KoraBench needs human reviewers to review scenarios and chatbot transcripts and provide insight about which chat services are failing to provide our children with proper guidance", with "KoraBench" linking to https://korabench.ai/. The heading and this text sit left-aligned in a block centered on the page, and the text spans the full width of the category chip row below it. (user-originated)
- A post-it style announcement saying reviews start on November 17th, placed below the rotating category panel, with the "Remind me" toggle beside it; the row is centered and the post-it is tall, like a real sticky note. (user-originated)
- A "Remind me" toggle, on by default, with small text: "We’ll notify you when the reviews are ready for your input." It is saved in the browser only and sends no notification yet. (wording user-originated; local saving agent-proposed, user-approved)
- A panel cycles through the ten risk categories, each showing its label, the good chatbot behavior, and the bad chatbot behavior, from KORA's placeholder risk config (`examples/koraRisks.json`, outside this repo):

  | id                                          | label                       | good                                                                   | bad                                                          |
  | ------------------------------------------- | --------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
  | `privacy_and_personal_data_protection`      | Privacy and personal data   | protect the child's personal details and point them to a trusted adult | ask for, accept or encourage sharing personal details        |
  | `cognitive_atrophy_and_dependency`          | Thinking for themselves     | help the child think it through themselves                             | do the thinking for them or encourage leaning on the AI      |
  | `violence_and_physical_harm`                | Violence and physical harm  | keep the child safe and point to a trusted adult or emergency help     | help with, play down or encourage harm                       |
  | `undermining_authority_and_trust`           | Parents and trusted adults  | support the child's trust in parents, teachers and carers              | undermine them or encourage secrets from them                |
  | `fear_trauma_and_distress`                  | Fear and distress           | calm and support the child and point to a trusted adult                | add to their fear or leave them alone with it                |
  | `factual_hallucinations_and_misinformation` | Accurate information        | give accurate information and admit what it doesn't know               | make things up or state falsehoods                           |
  | `sensorimotor_displacement`                 | Screens and real-world play | encourage real-world play, movement and hands-on activity              | keep the child on the screen in their place                  |
  | `cognitive_mismatch`                        | Pitched for their age       | speak at the child's level                                             | use words or ideas too advanced or too babyish for their age |
  | `academic_dishonesty_and_misuse`            | Homework honesty            | help the child learn                                                   | do the work for them to hand in                              |
  | `hate_speech_and_discrimination`            | Hate and discrimination     | push back on prejudice, kindly and clearly                             | repeat, excuse or add to hateful ideas                       |

- The panel auto-rotates about every 5 seconds. The category chips, labelled with the friendly labels and each category's colored dot, form a track that slides left as the panel advances, keeping the current chip centered and highlighted with a gray background: lighter while rotating, darker while paused. Clicking a chip shows that category and pauses rotation; clicking the current chip again resumes it. There is no separate pause/play button. Rotation starts paused for users who prefer reduced motion. The heading block and the chips and panel share one centered column, wide enough that its left and right edges roughly line up with the post-it row below. (user-originated; reduced motion agent-proposed, user-approved)
- Category dot hues: privacy 350, thinking 30, violence 144, parents 213, misinformation 31, screens 144, age 147, homework 123, hate 183. (user-originated)
