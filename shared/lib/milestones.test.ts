import {
  filledSegments,
  milestoneKind,
  MilestoneKind,
  type Milestone,
} from "./milestones";

const track: Milestone[] = [
  { members: 30, label: "a" },
  { members: 100, label: "b" },
  { members: 300, label: "c" },
  { members: 1000, label: "d", kind: MilestoneKind.Plan },
];

describe("filledSegments", () => {
  it("is empty below the first milestone", () => {
    expect(filledSegments(track, 0)).toBe(0);
  });

  it("counts a milestone as whole once it is reached", () => {
    expect(filledSegments(track, 30)).toBe(1);
    expect(filledSegments(track, 300)).toBe(3);
  });

  it("measures a part-filled bar from the milestone before it, not from zero", () => {
    expect(filledSegments(track, 200)).toBe(2.5);
    expect(filledSegments(track, 65)).toBeCloseTo(1.5);
  });

  // The plan joining the track must not move the bars in front of it. Its own
  // bar does fill past 300, which is the point of putting it on the track.
  it("leaves the bars in front of the plan where they were", () => {
    const fill = (milestones: Milestone[], members: number, i: number) =>
      Math.min(Math.max(filledSegments(milestones, members) - i, 0), 1);

    for (const members of [0, 29, 30, 65, 100, 200, 300, 301, 999]) {
      for (const i of [0, 1, 2]) {
        expect(fill(track, members, i)).toBe(
          fill(track.slice(0, 3), members, i),
        );
      }
    }
  });

  it("fills the plan bar on the way from 300 to 1,000", () => {
    expect(filledSegments(track, 300) - 3).toBe(0);
    expect(filledSegments(track, 650) - 3).toBeCloseTo(0.5);
  });

  it("fills the whole track once the last milestone is reached", () => {
    expect(filledSegments(track, 1000)).toBe(4);
    expect(filledSegments(track, 5000)).toBe(4);
  });
});

describe("milestoneKind", () => {
  it("treats an unmarked milestone as an example", () => {
    expect(milestoneKind(track[0])).toBe(MilestoneKind.Example);
    expect(milestoneKind(track[3])).toBe(MilestoneKind.Plan);
  });
});
