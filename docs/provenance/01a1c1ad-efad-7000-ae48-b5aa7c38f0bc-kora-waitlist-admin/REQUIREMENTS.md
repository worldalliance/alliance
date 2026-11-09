---
user: Alex Dorey
task: Spec a waitlist management tool in the admin panel for the Kora project
---

# Kora waitlist management

## R1. Purpose

Origin: user.

People sign up for the Kora project's waitlist on `/projects/safer-chatbots-for-children`, which creates Kora participants (`docs/provenance/01a18382-582d-7000-9435-690c2103eb8a-kora-participant-auth`). The admin panel (`apps/admin`) gets a waitlist management tool for them.

## R2. Location

Origin: user.

The tool has its own entry in the admin sidebar, "Kora participants".

## R3. Participant list

Origin: agent-proposed, user-approved.

The tool lists every Kora participant with name, email or phone number, sign-in methods (email code, SMS code, Google, Apple), timezone, and signup date. The list is searchable and sortable. It shows the total number of participants and signups per day, and exports the list as CSV.

## R4. Deleting a participant

Origin: agent-proposed, user-approved.

Staff can delete a participant from the tool, for removal or privacy requests.

## R5. Messaging

Origin: agent-proposed, user-approved.

The tool sends no messages. Staff reach participants by exporting the CSV and using existing email or SMS tools.

## R6. Access

Origin: agent-proposed, user-approved.

Any admin who can see the member waitlist can use the tool, including participants' contact details.

## R7. Abandoned signups

Origin: user, except keeping a recovered record and one record per contact, which are agent-proposed and user-approved.

A signup is abandoned when its contact was verified (by code, Google or Apple) but no name was entered before it ended. Each contact that abandoned a signup is recorded once, with its contact and the verification method and time of its latest abandoned signup, so someone who backs out several times counts as one person. The tool lists and counts these people, and the CSV export includes them, so staff can follow up.

When the same contact later becomes a participant, its abandoned record stays and is marked recovered, so the tool shows both how many people abandoned a signup and how many came back.

## R8. Out of scope

Origin: agent-proposed, user-approved.

The project page's participant progress bar, which counts Alliance members rather than Kora participants, is separate work.
