const MissedSuiteNote = ({ hasSuite }: { hasSuite: boolean }) =>
  hasSuite ? (
    <p className="text-sm text-zinc-500">
      Missed-suite group: once the suite closes, each member of this group who
      missed a required task gets one notice for the suite. Their run of
      consecutive missed suites picks the copy: a first miss gets this copy or
      the report copy, and a second consecutive miss gets the fixed second-miss
      copy. From a third consecutive miss on, this group sends nothing; the
      suspension notice replaces it. Until the suite closes, the reminder plans
      list every member of the group, including those who will not be notified.
    </p>
  ) : (
    <p className="text-sm text-red-600">
      This missed-suite group has no suite, so it sends nothing.
    </p>
  );

export default MissedSuiteNote;
