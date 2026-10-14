import { ActionEvent } from "src/actions/entities/action-event.entity";
import {
  ReminderCohortType,
  ReminderGroupTimingMode,
} from "src/actions/entities/reminder-group.entity";
import {
  isSocialProofReminderGroup,
  pickSocialProofPair,
  renderWithNames,
  SOCIAL_PROOF_SECONDS_FROM_DEADLINE,
  socialProofTemplates,
  type SocialProofCandidate,
} from "./reminder-social-proof";

const threeHourGroup = {
  timingMode: ReminderGroupTimingMode.FromDeadline,
  sendAtSecondsFromDeadline: SOCIAL_PROOF_SECONDS_FROM_DEADLINE,
  timingAnchorEvent: null,
  cohortType: ReminderCohortType.AllUncompleted,
};

const candidate = (id: number, isFriend: boolean): SocialProofCandidate => ({
  id,
  name: `Member ${id}`,
  isFriend,
});

describe("isSocialProofReminderGroup", () => {
  it.each([
    ReminderCohortType.AllUncompleted,
    ReminderCohortType.Tag,
    ReminderCohortType.Custom,
  ])("includes a three-hour %s reminder", (cohortType) => {
    expect(isSocialProofReminderGroup({ ...threeHourGroup, cohortType })).toBe(
      true,
    );
  });

  it.each([
    { cohortType: ReminderCohortType.GroupLeadsWithUncompleted },
    { sendAtSecondsFromDeadline: SOCIAL_PROOF_SECONDS_FROM_DEADLINE - 1 },
    { timingMode: ReminderGroupTimingMode.WithinRelativeRange },
    { timingAnchorEvent: Object.assign(new ActionEvent(), { id: 1 }) },
  ])("excludes %p", (override) => {
    expect(isSocialProofReminderGroup({ ...threeHourGroup, ...override })).toBe(
      false,
    );
  });
});

describe("pickSocialProofPair", () => {
  it("picks two distinct friends when two qualify", () => {
    for (let run = 0; run < 20; run++) {
      const pair = pickSocialProofPair([
        candidate(1, false),
        candidate(2, true),
        candidate(3, true),
        candidate(4, true),
        candidate(5, false),
      ]);
      expect(pair?.every((member) => member.isFriend)).toBe(true);
      expect(new Set(pair?.map((member) => member.id)).size).toBe(2);
    }
  });

  it("pairs a lone friend with another completer", () => {
    const pair = pickSocialProofPair([
      candidate(1, false),
      candidate(2, true),
      candidate(3, false),
    ]);
    expect(pair?.[0].id).toBe(2);
    expect([1, 3]).toContain(pair?.[1].id);
  });

  it("picks two other completers without friends", () => {
    const pair = pickSocialProofPair([
      candidate(1, false),
      candidate(2, false),
    ]);
    expect(pair?.map((member) => member.id).sort()).toEqual([1, 2]);
  });

  it.each([[[]], [[candidate(1, true)]], [[candidate(1, false)]]])(
    "returns null when fewer than two qualify",
    (candidates) => {
      expect(pickSocialProofPair(candidates)).toBeNull();
    },
  );
});

describe("renderWithNames", () => {
  const render = async (text: string) =>
    text.replaceAll("#{n}", "2").replaceAll("#{it|them}", "them");

  it("keeps template syntax in names literal", async () => {
    const pair: [SocialProofCandidate, SocialProofCandidate] = [
      { id: 1, name: "Ana #{n} $&", isFriend: true },
      { id: 2, name: "Bo #{it|them}", isFriend: false },
    ];
    expect(
      await renderWithNames({
        template: "#{n}: #{names} did #{it|them}.",
        pair,
        render,
      }),
    ).toBe("2: Ana #{n} $& and Bo #{it|them} did them.");
  });

  it("renders the template alone without a pair", async () => {
    expect(
      await renderWithNames({ template: "#{n} left", pair: null, render }),
    ).toBe("2 left");
  });
});

describe("socialProofTemplates", () => {
  const group = {
    pushMessage: "Custom push",
    textMessage: "Custom text",
    emailSubject: "Custom subject",
    emailMessage: "Custom email",
  };

  it("keeps the group's copy without a pair", () => {
    expect(socialProofTemplates(group, null)).toEqual(group);
  });

  it("replaces push and text but keeps the group's email", () => {
    const templates = socialProofTemplates(group, [
      candidate(1, true),
      candidate(2, true),
    ]);
    expect(templates).toEqual({
      pushMessage:
        "#{timeremaining} left for #{n} task#{s}. #{names} have already completed #{it|them}.",
      textMessage:
        "You have #{timeremaining} left to complete #{n} Alliance task#{s}. #{names} have already completed #{it|them}. #{link}",
      emailSubject: "Custom subject",
      emailMessage: "Custom email",
    });
  });
});
