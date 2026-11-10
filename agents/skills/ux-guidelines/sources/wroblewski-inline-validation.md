# Inline Validation in Web Forms

Source: <https://alistapart.com/article/inline-validation-in-web-forms/>

Retrieved: 2026-11-09

Copyright © 1998–2026 A List Apart & Our Authors. Excerpts only, quoted for the guidelines items that cite this page; the page itself has the rest.

---

> In this version of the form, we displayed a validation message (success or error), after the user indicated that she was done answering a question by moving on to the next one. (This is validating “on blur” in technical speak.)
>
> When we used the “after” method in the first half of the form, participants completed the form seven to ten seconds faster than when we used the “while” and “before and while” methods respectively. Why? Here’s what happened when we used the “while” and “before and while” methods: When several participants noticed an error message while trying to answer a question, they entered one additional character into the input field, than waited for the message to update. If the updated message continued to show an error, they entered another character, then waited for the validation message to update again, and so on, resulting in longer average completion times.
>
> The “before and while” method not only caused longer completion times, but also produced higher error rates and worse satisfaction ratings than the other inline validation variations we tested. Our participants articulated their strong distaste for this methodology:
>
> These negative reactions, longer completion times, and error rates illustrate that validating inputs prematurely can be harmful. Instead, when you validate open-ended questions, give feedback _after_ the user finishes providing an answer. Or in situations in which people need help sooner, give feedback _while_ they work toward an answer, but use an appropriate delay so premature error messages don’t frustrate them.
