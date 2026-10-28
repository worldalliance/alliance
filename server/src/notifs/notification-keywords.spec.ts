import { Action } from "src/actions/entities/action.entity";
import { User } from "src/user/entities/user.entity";
import { processKeywordReplacements } from "./notification-keywords";

describe("processKeywordReplacements", () => {
  let originalAppUrl: string | undefined;

  beforeAll(() => {
    originalAppUrl = process.env.APP_URL;
    process.env.APP_URL = "https://app.example.org";
  });

  afterAll(() => {
    process.env.APP_URL = originalAppUrl;
  });

  const baseContext = {
    user: { id: 1, name: "Jane Doe" } as User,
    action: { id: 10, name: "Test Action" } as Action,
    uncompletedTasksTime: "90 minutes",
    uncompletedTasksNames: ["Task A", "Task B"],
  };

  describe("simple placeholders", () => {
    it("replaces #{firstname}, #{lastname}, #{fullname}, #{action}", () => {
      const result = processKeywordReplacements(
        "Hi #{firstname} #{lastname} (#{fullname}), #{action}",
        {
          ...baseContext,
          uncompletedTasksCount: 1,
        },
      );
      expect(result).toBe("Hi Jane Doe (Jane Doe), Test Action");
    });

    it("replaces #{n}, #{s}, #{tasknames}, #{tasktime}", () => {
      const result = processKeywordReplacements(
        "#{n} task#{s}: #{tasknames} (#{tasktime})",
        {
          ...baseContext,
          uncompletedTasksCount: 2,
        },
      );
      expect(result).toBe("2 tasks: Task A, Task B (90 minutes)");
    });

    it("replaces #{link} and #{grouplink}", () => {
      const result = processKeywordReplacements(
        "Link: #{link} Group: #{grouplink}",
        { ...baseContext, uncompletedTasksCount: 1 },
      );
      expect(result).toBe(
        "Link: https://app.example.org/tasks Group: https://app.example.org/groups?tab=members",
      );
    });

    it("links #{link} and #{grouplink} to ALT_APP_URL when set", () => {
      const originalAltAppUrl = process.env.ALT_APP_URL;
      process.env.ALT_APP_URL = "https://alt.example.org";
      try {
        const result = processKeywordReplacements(
          "Link: #{link} Group: #{grouplink}",
          { ...baseContext, uncompletedTasksCount: 1 },
        );
        expect(result).toBe(
          "Link: https://alt.example.org/tasks Group: https://alt.example.org/groups?tab=members",
        );
      } finally {
        process.env.ALT_APP_URL = originalAltAppUrl;
      }
    });

    it("explains reliability when the member misses their first action", () => {
      const result = processKeywordReplacements(
        "#{missedactioncontext}\n#{secondmisswarning}",
        {
          ...baseContext,
          uncompletedTasksCount: 1,
          isFirstAssignedSuite: true,
        },
      );

      expect(result).toContain("The Alliance counts on every member");
      expect(result).toContain("To learn more about our model");
      expect(result).toContain("if you miss several actions in a row");
      expect(result).not.toContain("contract will be suspended");
    });

    it("renders #{secondmisswarning} as nothing", () => {
      expect(
        processKeywordReplacements("a#{secondmisswarning}b", {
          ...baseContext,
          uncompletedTasksCount: 1,
        }),
      ).toBe("ab");
    });

    it("keeps an ordinary missed-action email brief for returning members", () => {
      const result = processKeywordReplacements(
        "#{missedactioncontext}#{secondmisswarning}",
        {
          ...baseContext,
          uncompletedTasksCount: 1,
          isFirstAssignedSuite: false,
        },
      );

      expect(result).toBe(
        "Remember that we plan each action around the number of members we expect to participate.",
      );
    });
  });

  describe("#{x|y} singular/plural", () => {
    it("uses left part when uncompletedTasksCount === 1", () => {
      const result = processKeywordReplacements(
        "You have #{1 task|2 tasks} left.",
        { ...baseContext, uncompletedTasksCount: 1 },
      );
      expect(result).toBe("You have 1 task left.");
    });

    it("uses right part when uncompletedTasksCount !== 1", () => {
      const result = processKeywordReplacements(
        "You have #{1 task|2 tasks} left.",
        { ...baseContext, uncompletedTasksCount: 3 },
      );
      expect(result).toBe("You have 2 tasks left.");
    });
  });

  describe("#{\\n|\\n\\n} and escape sequences", () => {
    it("replaces #{\\n|\\n\\n} with one newline when n === 1", () => {
      const result = processKeywordReplacements("Line1#{\\n|\\n\\n}Line2", {
        ...baseContext,
        uncompletedTasksCount: 1,
      });
      expect(result).toBe("Line1\nLine2");
      expect(result).toEqual(`Line1${"\n"}Line2`);
    });

    it("replaces #{\\n|\\n\\n} with two newlines when n !== 1", () => {
      const result = processKeywordReplacements("Line1#{\\n|\\n\\n}Line2", {
        ...baseContext,
        uncompletedTasksCount: 2,
      });
      expect(result).toBe("Line1\n\nLine2");
      expect(result).toEqual(`Line1${"\n"}${"\n"}Line2`);
    });

    it("interprets \\t in #{x|y} as tab", () => {
      const result = processKeywordReplacements("A#{\\t|\\t\\t}B", {
        ...baseContext,
        uncompletedTasksCount: 1,
      });
      expect(result).toBe("A\tB");
    });

    it("interprets \\t in #{x|y} as double tab when plural", () => {
      const result = processKeywordReplacements("A#{\\t|\\t\\t}B", {
        ...baseContext,
        uncompletedTasksCount: 2,
      });
      expect(result).toBe("A\t\tB");
    });

    it("interprets \\\\ as single backslash in replacement", () => {
      const result = processKeywordReplacements("Path: #{a\\\\b|a\\\\b\\\\c}", {
        ...baseContext,
        uncompletedTasksCount: 1,
      });
      expect(result).toBe("Path: a\\b");
    });

    it("combines escaped newlines with other placeholders", () => {
      const result = processKeywordReplacements(
        "Hi #{firstname},#{\\n|\\n\\n}#{n} task#{s}",
        { ...baseContext, uncompletedTasksCount: 1 },
      );
      expect(result).toBe(`Hi Jane,\n1 task`);
    });
  });
});
