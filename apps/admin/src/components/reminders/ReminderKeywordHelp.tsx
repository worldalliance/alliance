import { cn } from "@alliance/shared/styles/util";
import React, { useState } from "react";

export const keywords = [
  "#{fullname}",
  "#{firstname}",
  "#{lastname}",
  "#{action}",
  "#{days}",
  "#{hours}",
  "#{link}",
  "#{n}",
  "#{s}",
  "#{timeremaining}",
  "#{tasktime}",
  "#{tasknames}",
  "#{nmembers}",
  "#{grouplink}",
  "#{formattedtasklist}",
];

const ReminderKeywordHelp: React.FC = () => {
  const [keywordsHelpExpanded, setKeywordsHelpExpanded] = useState(false);

  return (
    <div
      className={cn(
        "border border-gray-200 rounded-md bg-zinc-100",
        !keywordsHelpExpanded && "hover:border-gray-300",
      )}
    >
      <button
        type="button"
        onClick={() => setKeywordsHelpExpanded(!keywordsHelpExpanded)}
        className="text-sm w-full text-left p-3"
      >
        Keyword replacement syntax{keywordsHelpExpanded ? " " : "..."}
      </button>
      {keywordsHelpExpanded && (
        <div className="mt-2 text-sm">
          <table id="keywordstable" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Keyword</th>
                <th>Example Value</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{"#{fullname}"}</td>
                <td>John Fitzgerald Doe</td>
                <td>Member&apos;s full name</td>
              </tr>
              <tr>
                <td>{"#{firstname}"}</td>
                <td>John</td>
                <td>Member&apos;s first name</td>
              </tr>
              <tr>
                <td>{"#{lastname}"}</td>
                <td>Doe</td>
                <td>Member&apos;s last name</td>
              </tr>
              <tr>
                <td>{"#{action}"}</td>
                <td>Sign a petition to use less cups</td>
                <td>The name of the action</td>
              </tr>
              <tr>
                <td>{"#{days}"}</td>
                <td>2 days</td>
                <td>
                  The number of days until the action is due, with
                  &apos;days&apos; attached
                </td>
              </tr>
              <tr>
                <td>{"#{n}"}</td>
                <td>2</td>
                <td>Total uncompleted tasks for this user</td>
              </tr>
              <tr>
                <td>{"#{hours}"}</td>
                <td>1 hour</td>
                <td>
                  The number of hours until the action is due, with
                  &apos;hours&apos; attached. Note: assumes usage with days, so
                  will not show more than 24 hours. (ie an action due in 25
                  hours will show &quot;1 hour&quot;) to allow rendering &quot;1
                  day 1 hour remaining&quot;
                </td>
              </tr>
              <tr>
                <td>{"#{timeremaining}"}</td>
                <td>2 days, 3 hours</td>
                <td>
                  The number of days and hours until the action is due. In most
                  cases equivalent to {`#{days}, #{hours}`}, but will trim
                  &quot;0 days&quot; or &quot;0 hours&quot; from the message.
                  (days is floored, hours is rounded)
                </td>
              </tr>
              <tr>
                <td>{"#{tasktime}"}</td>
                <td>15 minutes</td>
                <td>
                  The total estimated minutes it will take for the user to
                  finish all uncompleted tasks.
                </td>
              </tr>
              <tr>
                <td>{"#{tasknames}"}</td>
                <td>Task 1, Task 2, Task 3</td>
                <td>
                  The names of the uncompleted actions for this user, separated
                  by commas. Based on the &quot;use suite task count&quot; flag,
                  will either include all actions, or only actions in this
                  suite.
                </td>
              </tr>
              <tr>
                <td>{"#{link}"}</td>
                <td>https://worldalliance.org/tasks?cid=123</td>
                <td>
                  The link to the user&apos;s tasks page, with tracking CID
                  included
                </td>
              </tr>
              <tr>
                <td>{"#{s}"}</td>
                <td>s</td>
                <td>
                  Conditionally inserts an s if {`#{n}`} is a value other than
                  1, or an empty string if {`#{n}`} is 1
                </td>
              </tr>
              <tr>
                <td>{"#{formattedtasklist}"}</td>
                <td>
                  1. Task 1<br />
                  2. Task 2<br />
                  3. Task 3<br />
                  <br />
                  or
                  <br />
                  <br />
                  Task 1
                </td>
                <td>
                  The list of uncompleted tasks for this user, formatted as a
                  numbered list. If there is a single task, it will be displayed
                  without a number.
                </td>
              </tr>
              <tr>
                <td>{"#{str1|str2}"}</td>
                <td>str1</td>
                <td>
                  Inserts the string before the bar if {`#{n}`} is 1, otherwise
                  inserts the string after the bar
                </td>
              </tr>
            </tbody>
          </table>
          <p className="text-sm text-zinc-600 m-3">
            If you are using the suite task count, all task count related values
            will be based on the number of uncompleted tasks only in this action
            suite. If the reminder group is not associated with an action suite,
            the flag has no effect (global count will always be used).
          </p>
        </div>
      )}
    </div>
  );
};

export default ReminderKeywordHelp;
