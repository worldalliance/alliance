# Decisions

## D1. Channel follows the verified contact

A participant has exactly one contact, email or phone, so R1's "email or text" is the channel they verified with: email participants get an email, phone participants a text.

## D2. Sent only when a participant is created

The confirmation goes out whenever `createParticipant` inserts a participant: a code signup completed with a name, a Google or Apple signup that supplied a name, and one completed with a name afterwards. Google and Apple participants get it by email. Returning participants signing in, and a concurrent signup that finds the participant already created, get none, so nobody is thanked twice.

## D3. Unrecorded, not awaited

Delivery uses `sendUnrecordedMail` / `sendUnrecordedText`, as the sign-in codes do. The recorded SMS path needs a member user id, which participants lack. Signup completes without waiting on delivery: a failed or slow send is logged and does not block the participant from signing in.

## D4. Link host from the environment

The demo link is built from the site base URL plus `/projects/safer-chatbots-for-children`, so production links to https://thealliance.org/projects/safer-chatbots-for-children and staging to its own page.
