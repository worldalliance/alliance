import { useEffect } from "react";
import { initCharts } from "./charts-engine";
import "./plant-based-study.css";

export default function PlantBasedStudyResults() {
  useEffect(() => {
    const controller = new AbortController();
    initCharts(controller.signal);
    return () => controller.abort();
  }, []);

  return (
    <div className="ir">
      <header className="masthead">
        <p className="mb-3 text-sm text-(--sub)">
          <time dateTime="2026-07-16">July 16, 2026</time>
        </p>
        <h1>
          Thinking about eating more plant-based? Here&apos;s what to expect.
        </h1>
        <div className="flex flex-col gap-2">
          <p className="dek">
            We ran a study with 274 people to measure how much less animal
            product people could eat if they tried.
          </p>
          <p className="dek">
            Participants sent us daily food logs for 14 days. A{" "}
            <span className="font-semibold">reduction group</span> of 219 people
            attempted to reduce their animal product consumption, while a{" "}
            <span className="font-semibold">comparison group</span> of 55 were
            told to eat as normal.
          </p>
        </div>
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

      {/* ============ Finding 1: the cut ============ */}
      <section className="finding" id="cut" aria-labelledby="h-cut">
        <div className="prose text-col">
          <p className="kick">Finding 1 of 6</p>
          <h2 id="h-cut">You’ll probably be able to reduce by about half</h2>
          <p>
            We converted people’s daily food logs into{" "}
            <strong>grams of animal protein per day</strong>:
          </p>
          <div
            className="scale-chips"
            aria-label="What a gram of animal protein looks like"
          >
            <span>3-oz serving of meat ≈ 26 g</span>
            <span>cup of milk ≈ 8.5 g</span>
            <span>one egg ≈ 6.3 g</span>
          </div>
          <p>
            Before day one, both groups reported their normal diet at about{" "}
            <strong>46 g of animal protein a day</strong>. During the study,
            both groups reported eating less animal product than they normally
            did: the comparison group about a third less, the reduction group
            about half.
          </p>
          <p>
            The gap between the groups held for all fourteen days. Over the full
            two weeks, <strong>the reduction group averaged about half</strong>{" "}
            of what they started from, going from 46 g a day to 23 g a day. The
            comparison group ended at 33 g a day.
          </p>
          <p>
            To interpret these results fairly, it&rsquo;s important to note that
            participants likely overestimated how much they normally ate,
            underreported what they ate during the study, or reduced despite
            being told to eat as normal.
          </p>
        </div>
        <figure className="fig">
          <figcaption className="fig-head">
            <span className="fig-eyebrow">
              Both groups · average logged day, day by day
            </span>
            <strong className="fig-title">
              Most participants reduced by more than half
            </strong>
          </figcaption>
          <p className="legend">
            <span>
              <span
                className="dot"
                style={{ background: "var(--reduction)" }}
              />
              reduction group
            </span>
            <span>
              <span
                className="dot"
                style={{ background: "var(--comparison)" }}
              />
              comparison group
            </span>
          </p>
          <div
            className="chart"
            id="chart-hero"
            tabIndex={0}
            role="group"
            aria-roledescription="interactive chart"
            aria-label="Line chart of each group's average daily animal protein over 14 days. Both groups reported about 46 grams a day beforehand, marked as a dashed line across the chart. The comparison group's average day runs around 26 to 40 grams; the reduction group's around 19 to 25, ending at a two-week average of 23 grams, marked as a second dashed line. Use left and right arrow keys to step through the days."
          />
          <p className="fig-note">
            Each bold line follows the group’s <em>average</em> logged day;
            shaded bands are 95% confidence intervals. Hover for any day’s
            numbers.{" "}
            <span className="n">
              Reduction n&nbsp;=&nbsp;219 · comparison n&nbsp;=&nbsp;54 of 55
              (one gave no baseline figure).
            </span>
          </p>
        </figure>
      </section>

      {/* ============ Finding 2: surprise score ============ */}
      <section className="finding" id="surprise" aria-labelledby="h-surprise">
        <div className="prose text-col">
          <p className="kick">Finding 2 of 6</p>
          <h2 id="h-surprise">
            You’ll likely find it about as hard as you expect
          </h2>
          <p>
            Before the study, each person in the reduction group rated how
            difficult they <em>expected</em> the two weeks to be, from 1 to 5.
            Afterward, they rated how difficult it actually <em>was</em>. The
            difference between the two ratings measures how <em>surprised</em> a
            person was.
          </p>
          <p>
            Nearly half thought it was exactly as hard as they expected, and{" "}
            <strong>
              9 in 10 were within one point of their initial guess.
            </strong>
          </p>
        </div>
        <figure className="fig">
          <figcaption className="fig-head">
            <span className="fig-eyebrow">
              Reduction group · how it felt minus how they thought it would feel
            </span>
            <strong className="fig-title">
              Most found it as hard as they expected
            </strong>
          </figcaption>
          <div
            className="chart"
            id="chart-gap"
            role="img"
            aria-label="Bar chart of the surprise score. 3 percent found it much easier than expected, 18 percent a little easier, 46 percent exactly as expected, 26 percent a little harder, 6 percent much harder. A bracket marks that 91 percent were within one point of their guess."
          />
          <p className="fig-note">
            Each bar is the share of the reduction group whose difficulty rating
            shifted by that amount. Hover a bar for the count.{" "}
            <span className="n">
              Reduction group, n&nbsp;=&nbsp;202 (17 didn’t answer both
              questions).
            </span>
          </p>
        </figure>
      </section>

      {/* ============ Finding 3: every split cut roughly half ============ */}
      <section className="finding" id="who" aria-labelledby="h-who">
        <div className="prose text-col">
          <p className="kick">Finding 3 of 6</p>
          <h2 id="h-who">
            Your age, gender, or experienced difficulty probably won’t affect
            how much you’re able to reduce
          </h2>
          <p>
            You might expect some groups of people to reduce a lot more than
            others: men or women, younger or older, the people who expected it
            to be easy, the people who found it easy.
          </p>
          <p>
            However,{" "}
            <strong>
              every group&rsquo;s typical reduction was between 39% and 52% of
              their normal intake
            </strong>{" "}
            — cutting roughly half — while the typical member of the comparison
            group ate 82%. Even people who found the study hard cut about as
            much as the people who found it easy.
          </p>
        </div>
        <figure className="fig">
          <figcaption className="fig-head">
            <span className="fig-eyebrow">
              Reduction group · share of normal intake still eaten
            </span>
            <strong className="fig-title">
              Every way we sliced it, people reduced about half
            </strong>
          </figcaption>
          <div
            className="fig-controls"
            role="radiogroup"
            aria-label="Split the dots by"
            id="who-controls"
          >
            <span className="ctl-label">Split by</span>
            <button
              className="chip"
              data-mode="pre"
              role="radio"
              aria-checked="true"
              aria-pressed="true"
              type="button"
            >
              Expected difficulty
            </button>
            <button
              className="chip"
              data-mode="post"
              role="radio"
              aria-checked="false"
              aria-pressed="false"
              type="button"
            >
              Experienced difficulty
            </button>
            <button
              className="chip"
              data-mode="g"
              role="radio"
              aria-checked="false"
              aria-pressed="false"
              type="button"
            >
              Gender
            </button>
            <button
              className="chip"
              data-mode="a"
              role="radio"
              aria-checked="false"
              aria-pressed="false"
              type="button"
            >
              Age
            </button>
          </div>
          <div
            className="chart"
            id="chart-who"
            role="img"
            aria-label="Dot plot of every reduction-group participant by share of normal intake, regroupable by expected difficulty, experienced difficulty, gender, or age. In every grouping each row's typical value lands between 39 and 52 percent, far below the comparison group's 82 percent, marked as a dashed reference line."
          />
          <p className="fig-note">
            Each dot is one person; the tall tick marks each row’s typical
            (middle) person, with its value printed beside it. The dashed line
            is the comparison group’s typical (82%) for reference. Hover any dot
            for its numbers. Not shown: 9 people with baselines under 5&nbsp;g,
            6 who ate above 150%, and anyone who skipped the question the graph
            is split on.{" "}
            <span className="n">
              Reduction group, n&nbsp;=&nbsp;210 (204 shown).
            </span>
          </p>
        </figure>
      </section>

      {/* ============ Finding 4: cravings ============ */}
      <section className="finding" id="hard" aria-labelledby="h-hard">
        <div className="prose text-col">
          <p className="kick">Finding 4 of 6</p>
          <h2 id="h-hard">You’ll probably have cravings</h2>
          <p>
            At the beginning of the study, we asked participants what they
            thought would be hard. At the end of the study, we asked them what
            they actually found hard.
          </p>
          <p>
            Going in, people were most worried about cravings, protein, and
            finding plant-based options. Coming out, <strong>cravings</strong>,
            such as missing the flavor of meat or ice cream, were clearly the
            most common difficulty, named by 27% before compared to{" "}
            <strong>44% after</strong>. Protein and nutrition worries barely
            increased (24% → 30%).
          </p>
        </div>
        <figure className="fig">
          <figcaption className="fig-head">
            <span className="fig-eyebrow">
              Reduction group · share naming each difficulty
            </span>
            <strong className="fig-title">
              What’s difficult about eating plant-based, expected and
              experienced
            </strong>
          </figcaption>
          <p className="legend">
            <span>
              <span className="dot" style={{ background: "var(--axis)" }} />
              expected, before
            </span>
            <span>
              <span
                className="dot"
                style={{ background: "var(--reduction)" }}
              />
              experienced, after
            </span>
          </p>
          <div
            className="fig-controls"
            role="radiogroup"
            aria-label="Sort rows by"
            id="dumbbell-controls"
          >
            <span className="ctl-label">Sort by</span>
            <button
              className="chip"
              data-sort="after"
              role="radio"
              aria-checked="true"
              aria-pressed="true"
              type="button"
            >
              Most experienced
            </button>

            <button
              className="chip"
              data-sort="before"
              role="radio"
              aria-checked="false"
              aria-pressed="false"
              type="button"
            >
              Most expected
            </button>
            <button
              className="chip"
              data-sort="change"
              role="radio"
              aria-checked="false"
              aria-pressed="false"
              type="button"
            >
              Biggest change
            </button>
          </div>
          <div
            className="chart"
            id="chart-dumbbell"
            role="img"
            aria-label="Before-and-after chart of eleven difficulties, sortable. Cravings rose from 27 to 44 percent, eating out from 17 to 32, finding options from 21 to 31, protein and nutrition from 24 to 30. Family, household and cooking-effort worries fell."
          />
          <p className="fig-note">
            Each row is the share of the reduction group naming that difficulty;
            people could name several. Hover a row for its numbers.{" "}
            <span className="n">
              Reduction group, n&nbsp;=&nbsp;210 before · 195 after.
            </span>
          </p>
        </figure>
      </section>

      {/* ============ Finding 5: intent ============ */}
      <section className="finding" id="next" aria-labelledby="h-next">
        <div className="prose text-col">
          <p className="kick">Finding 5 of 6</p>
          <h2 id="h-next">
            You&rsquo;ll probably want to keep going after trying
          </h2>
          <p>
            At the end, we asked everyone: as a result of the study, do you plan
            to keep more plant-based food in your long-term diet?{" "}
            <strong>85% said probably or definitely yes.</strong>
          </p>
          <p>
            We sent out a follow-up 30 days after the study ended to see what
            fraction followed through. The next finding summarizes what we
            found.
          </p>
        </div>
        <figure className="fig">
          <figcaption className="fig-head">
            <span className="fig-eyebrow">
              All respondents · “Will you keep eating more plant-based?”
            </span>
            <strong className="fig-title">
              Most plan to eat more plant-based
            </strong>
          </figcaption>
          <div
            className="chart"
            id="chart-plan"
            role="img"
            aria-label="One stacked bar of answers: 52 percent yes definitely, 33 percent probably yes, 6 percent unsure, 5 percent probably not, 4 percent no. A bracket marks the combined 85 percent."
          />
          <p className="fig-note">
            Each segment is the share of respondents giving that answer at study
            end. Hover a segment for the count.{" "}
            <span className="n">
              Final-survey respondents, n&nbsp;=&nbsp;281 (including
              participants excluded from the consumption analyses).
            </span>
          </p>
        </figure>
      </section>

      {/* ============ Finding 6: long-term change ============ */}
      <section className="finding" id="long-term" aria-labelledby="h-long-term">
        <div className="prose text-col">
          <p className="kick">Finding 6 of 6</p>
          <h2 id="h-long-term">You may change your long-term habits</h2>
          <p>
            Thirty days after the study ended, we asked participants what they
            were eating to see whether the changes they made during the study
            lasted. 83% of the participants in our analysis replied.
          </p>
          <p>
            <strong>
              The reduction group reported eating about a quarter less animal
              product than they had at sign-up.
            </strong>{" "}
            The comparison group&rsquo;s reported reduction was less than a
            quarter, but close enough that we can&rsquo;t say the study is what
            did it.
          </p>
          <p>
            The clearest difference was in how people summarized their eating
            habits: 53% of the reduction group said they now eat less animal
            product than before the study, against 33% of the comparison group.
          </p>
        </div>
      </section>

      <section className="report-note" id="how" aria-labelledby="h-how">
        <div className="rn-method">
          <h2 id="h-how">Methodology</h2>
          <p>
            Each day, participants reported what they ate by text message or,
            for those who enrolled by email, by a daily email and the study
            website. A language model (Claude Sonnet 4.6) was used to convert
            these free-form responses into a structured list of foods
            participants consumed.
          </p>
          <p>
            Each named food was then looked up in a reference table written into
            the script and converted into a low-to-high range of standard
            servings for each animal product category. The midpoint of the range
            was multiplied by a fixed per-category protein value (26 grams for
            meat, 20 for seafood, 8.5 for dairy, 6.3 for eggs). To test the
            sensitivity of our results, we recomputed each participant’s intake
            using food-specific protein estimates within each category. Both the
            per-participant totals and the estimated effect changed by less than
            10%, and all conclusions were unchanged.
          </p>
          <p>
            The daily grams of animal protein for each participant is the mean
            of their usable days. We exclude participants that did not log food
            consumption for three or more days. Inclusion rate was 59% for the
            comparison group and 60% for the reduction group. When using
            comparisons relative to participant baselines, the 14 participants
            with baselines under 5 grams were excluded.
          </p>
        </div>
        <a
          className="rn-pdf"
          href="/plant-based-study-paper.pdf"
          target="_blank"
          rel="noopener"
          aria-label="Open the full report (PDF)"
        >
          <span className="rn-page">
            <i className="rn-t" />
            <i />
            <i />
            <i />
            <i className="rn-s" />
            <i />
            <i />
            <i />
            <i className="rn-s" />
            <i />
          </span>
          <span className="rn-cap">full report · PDF</span>
        </a>
      </section>

      <div id="ir-tip" role="presentation" />
      <div className="visually-hidden" aria-live="polite" id="ir-live" />
    </div>
  );
}
