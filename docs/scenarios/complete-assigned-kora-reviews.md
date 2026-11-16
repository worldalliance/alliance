---
personas: [kora-parent-reviewer]
---

# Do my reviews while I wait for pickup

Partly unbuilt: the launch notification, the review task and the thank-you screen exist in no code yet. Only the project page and its sign-in exist.

- **Trigger**: the launch notification, by email or SMS to whichever contact he signed up with, saying the reviews are ready, with a link to the project page
- **Starting point**: on the waitlist since signing up on his phone, now on his laptop with no participant session

## Journey

1. Project page (`/projects/safer-chatbots-for-children`, `apps/frontend/src/components/projects/safer-chatbots-for-children-26/SaferChatbotsForChildren26.tsx`, `apps/frontend/src/components/projects/safer-chatbots-for-children-26/KoraSignIn.tsx`): he continues with the same email or mobile number and enters the six-digit code. As a returning participant, he isn't asked for his name again.
2. Reviews (unbuilt): he sees his assigned reviews and how many he has done out of how many are assigned.
3. Review (unbuilt): before a transcript on a sensitive topic, he sees a warning. He reads the transcript and rates how well the chatbot handled it.
4. Break (unbuilt): he closes the laptop partway through. When he comes back, he's on the exact review he left, including any rating he hadn't submitted.
5. Finish (unbuilt): after his last assigned review, the page thanks him for his work and says he'll get a notification if he's needed for more.

**Done when**: he sees the thank-you, with every assigned review rated.

## Where it goes wrong

- A mistyped code: "That code isn’t correct. Try again."
- An expired or replaced code: "That code is no longer valid. Request a new code."
- The code can't be sent: "We couldn’t send your code. Try again later or use another sign-in method."
- Too many requests: "Too many attempts. Try again in {wait}."
