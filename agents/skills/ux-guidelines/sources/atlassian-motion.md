# Motion

Source: <https://atlassian.design/foundations/motion>

Retrieved: 2026-11-09

© 2026 Atlassian. Excerpts only, quoted for the guidelines items that cite this page; the page itself has the rest.

---

> Every motion event is defined by three core attributes: duration, easing curve, and property.
>
> Duration defines how long a motion event takes from start to finish.
>
> #### Interactions (50–150ms)
>
> Used for hover and press states. Short durations ensure the interface feels immediately responsive and polished.
>
> #### Transitions (150–400ms)
>
> Used for elements entering, exiting, or moving on screen (e.g. Modals, Panels). Longer durations help users track spatial changes. Larger elements generally require longer durations to feel proportional.
>
> Easing curves control the acceleration and deceleration of motion, defining how a transition feels.
>
> #### Ease-out bold
>
> `cubic-bezier(0, 0.4, 0, 1)`Elements arrive quickly and decelerate to a stop. Best for elements like Panel or Flag entering the screen.
>
> #### Ease-in-out bold
>
> `cubic-bezier(0.4, 0, 0, 1)`Gentle start and soft settle. Best for scaling Modals or repositioning elements.
>
> #### Ease-in practical
>
> `cubic-bezier(0.6, 0, 0.8, 0.6)`Starts slowly and accelerates away. Best for exit transitions where elements get out of the way.
>
> #### Ease-out practical
>
> `cubic-bezier(0.4, 1, 0.6, 1)`Subtle, everyday entrance curve. Best for elements like Popup or hover background fades.
