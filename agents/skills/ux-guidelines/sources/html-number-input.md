# HTML Standard: 4.10.5 The input element

Source: <https://html.spec.whatwg.org/multipage/input.html>

Retrieved: 2026-11-09

Copyright © WHATWG (Apple, Google, Mozilla, Microsoft). This work is licensed under a Creative Commons Attribution 4.0 International License (https://creativecommons.org/licenses/by/4.0/). Excerpts only, quoted for the guidelines items that cite this page; the page itself has the rest.

---

> The `type=number` state is not appropriate for input that happens to only consist of numbers but isn't strictly speaking a number. For example, it would be inappropriate for credit card numbers or US postal codes. A simple way of determining whether to use `type=number` is to consider whether it would make sense for the input control to have a spinbox interface (e.g. with "up" and "down" arrows). Getting a credit card number wrong by 1 in the last digit isn't a minor mistake, it's as wrong as getting every digit incorrect. So it would not make sense for the user to select a credit card number using "up" and "down" buttons. When a spinbox interface is not appropriate, `type=text` is probably the right choice (possibly with an `[inputmode](https://html.spec.whatwg.org/multipage/interaction.html#attr-inputmode)` or `[pattern](https://html.spec.whatwg.org/multipage/input.html#attr-input-pattern)` attribute).
