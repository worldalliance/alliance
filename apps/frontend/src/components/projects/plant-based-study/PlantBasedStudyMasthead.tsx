export default function PlantBasedStudyMasthead() {
  return (
    <header className="masthead">
      <p className="mb-3 text-sm text-(--sub)">
        <time dateTime="2026-07-16">July 16, 2026</time>
      </p>
      <p className="dek">
        Participants sent us daily food logs for 14 days. A{" "}
        <span className="font-semibold">reduction group</span> of 219 people
        attempted to reduce their animal product consumption, while a{" "}
        <span className="font-semibold">comparison group</span> of 55 were told
        to eat as normal.
      </p>
      <p className="tk-lead">If you try eating more plant-based…</p>
      <nav className="tiles" aria-label="What to expect, based on the study">
        <a className="tile" href="#cut">
          <strong className="t-claim">
            You’ll probably be able to reduce by about half
          </strong>
          <span className="t-sub">
            The reduction group reported their normal diet had 46 grams/day of
            animal protein, and most ate less than 23 grams/day during the
            study.
          </span>
        </a>
        <a className="tile" href="#surprise">
          <strong className="t-claim">
            You’ll likely find it about as hard as you expect
          </strong>
          <span className="t-sub">
            9 in 10 found the study about as hard as they expected.
          </span>
        </a>
        <a className="tile" href="#who">
          <strong className="t-claim">
            Your age, gender, or experienced difficulty probably won’t affect
            how much you’re able to reduce
          </strong>
          <span className="t-sub">
            Men and women came out the same within a few points; younger
            participants cut a little more; and people who found the study
            harder cut a little less.
          </span>
        </a>
        <a className="tile" href="#hard">
          <strong className="t-claim">You’ll probably have cravings</strong>
          <span className="t-sub">
            Cravings were the most common difficulty, named by 27% of
            participants before the study and 44% after — more than protein or
            nutrition worries.
          </span>
        </a>
        <a className="tile" href="#next">
          <strong className="t-claim">
            You’ll probably want to keep going after trying
          </strong>
          <span className="t-sub">
            85% said they probably or definitely plan to keep more plant-based
            food in their long-term diet.
          </span>
        </a>
        <a className="tile" href="#long-term">
          <strong className="t-claim">
            You may change your long-term habits
          </strong>
          <span className="t-sub">
            30 days after the study ended, the reduction group reported eating
            about a quarter less than at sign-up.
          </span>
        </a>
      </nav>
    </header>
  );
}
