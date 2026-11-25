import { useId, useState } from "react";
import {
  ExpandToggle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../ui/Table";

const KEYWORDS: { keyword: string; example: string; description: string }[] = [
  {
    keyword: "#{fullname}",
    example: "John Fitzgerald Doe",
    description: "The member's full name.",
  },
  {
    keyword: "#{firstname}",
    example: "John",
    description: "The member's first name.",
  },
  {
    keyword: "#{lastname}",
    example: "Doe",
    description: "The member's last name.",
  },
  {
    keyword: "#{action}",
    example: "Sign a petition to use less cups",
    description: "The task's name.",
  },
  {
    keyword: "#{days}",
    example: "2 days",
    description: 'Days until the task is due, with "days" attached.',
  },
  {
    keyword: "#{n}",
    example: "2",
    description: "The member's uncompleted tasks.",
  },
  {
    keyword: "#{hours}",
    example: "1 hour",
    description:
      'Hours until the task is due, with "hours" attached. It assumes use with #{days}, so it never shows more than 24: a task due in 25 hours shows "1 hour", for "1 day 1 hour remaining".',
  },
  {
    keyword: "#{timeremaining}",
    example: "2 days, 3 hours",
    description:
      'Days and hours until the task is due. Usually #{days}, #{hours}, but it drops "0 days" or "0 hours". Days are floored, hours rounded.',
  },
  {
    keyword: "#{tasktime}",
    example: "15 minutes",
    description:
      "The estimated minutes to finish all the member's uncompleted tasks.",
  },
  {
    keyword: "#{tasknames}",
    example: "Task 1, Task 2, Task 3",
    description:
      "The member's uncompleted tasks, separated by commas: in this suite only with Use suite task count, else all of them.",
  },
  {
    keyword: "#{link}",
    example: "https://thealliance.org/tasks?cid=123",
    description: "The member's tasks page, with a tracking id.",
  },
  {
    keyword: "#{s}",
    example: "s",
    description: 'An "s" when #{n} isn\'t 1, else nothing.',
  },
  {
    keyword: "#{nmembers}",
    example: "3",
    description:
      "For group leads: how many members of their groups haven't completed.",
  },
  {
    keyword: "#{grouplink}",
    example: "https://thealliance.org/groups?tab=members",
    description: "For group leads: the members tab of their groups page.",
  },
  {
    keyword: "#{formattedtasklist}",
    example: "1. Task 1\n2. Task 2\n\nor\n\nTask 1",
    description:
      "The member's uncompleted tasks as a numbered list, or the one task without a number.",
  },
  {
    keyword: "#{str1|str2}",
    example: "str1",
    description:
      "The text before the bar when #{n} is 1, else the text after it.",
  },
];

export const keywords = KEYWORDS.map(({ keyword }) => keyword).filter(
  (keyword) => keyword !== "#{str1|str2}",
);

export function ReminderKeywordHelp() {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <div>
        <ExpandToggle
          expanded={open}
          controls={id}
          onToggle={() => setOpen((prev) => !prev)}
        >
          Keywords you can use
        </ExpandToggle>
      </div>
      {open && (
        <div id={id} className="flex flex-col gap-2">
          <div className="overflow-x-auto rounded-md border border-line">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Example</TableHead>
                  <TableHead>What it is</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {KEYWORDS.map(({ keyword, example, description }) => (
                  <TableRow key={keyword}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {keyword}
                    </TableCell>
                    <TableCell className="whitespace-pre-line">
                      {example}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {description}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-caption text-fg-muted">
            With Use suite task count, every count above covers only this
            suite&apos;s uncompleted tasks. A group not linked to a suite always
            counts every task.
          </p>
        </div>
      )}
    </div>
  );
}
