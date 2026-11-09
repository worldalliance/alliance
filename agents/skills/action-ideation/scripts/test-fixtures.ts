import {
  candidateHash,
  planHash,
  type Assessment,
  type Candidate,
  type Plan,
} from "./model";

export const candidate = (id: string): Candidate => ({
  id,
  title: "Synthetic proposal",
  priority: "Synthetic focus",
  member_task: "Contribute an example",
  minutes: "10, estimate",
  anywhere_anytime: "Asynchronous remote work",
  why_collective: "Combine varied examples",
  office_work: "Verify and deliver examples",
  intended_change: "A useful correction",
  closest_precedent: "None in synthetic history",
  difference: "Synthetic mechanism",
  key_assumption: "Recipient needs examples",
  smallest_pilot: "One accepted correction",
  rejection_reason: null,
});
export const assessment = (id: string, plan: Plan): Assessment => ({
  id,
  candidate_hash: candidateHash(candidate(id)),
  plan_hash: planHash(plan),
  constraint_failures: [],
  scores: { value: 3, novelty: 3, member_experience: 3, feasibility: 3 },
  reason: "Synthetic judgment",
  biggest_uncertainty: "Recipient demand",
  suggested_refinement: "Verify demand",
});
