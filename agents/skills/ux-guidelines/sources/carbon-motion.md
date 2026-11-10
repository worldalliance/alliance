# Motion

Source: <https://carbondesignsystem.com/elements/motion/overview/>

Retrieved: 2026-11-09

Copyright © 2026 IBM. Excerpts only, quoted for the guidelines items that cite this page; the page itself has the rest.

---

> Strictly linear movement appears unnatural to the human eye. Elements on the screen should speed up quickly and slow down smoothly, obeying the physics of a light-weight material. “Easing curves” describe the precise amount of accelerations in motion. We commonly use one of these three types of easing.
>
> Use `standard-easing` when an element is visible from the beginning to the end of a motion. Expanding tiles and the sorting of table rows are good examples.
>
> Use `exit-easing` when removing elements from view, such as closing a modal or toaster. The element speeds up as it exits from view, implying that its departure from the screen is permanent.
>
> Duration is calculated based on the style and size of the motion. Among the two motion styles, productive motion is significantly faster than expressive motion. Motion’s duration should be dynamic based on the size of the animation; the larger the change in distance (traveled) or size (scaling) of the element, the longer the animation takes.
>
> When custom duration is possible, please use the [Motion Generator](https://ibm.github.io/motion/) to get the customized duration calculated for your element. Carbon uses a non-linear duration scale to achieve better perceived consistency across all distances.
>
> Dynamic duration is an upcoming built-in feature for Carbon components and a part of the motion package. Currently, there are six static value tokens for easier implementation.
>
> | Token                  | Usage                                                         | Value |     |
> | ---------------------- | ------------------------------------------------------------- | ----- | --- |
> | `duration-fast-01`     | Micro-interactions such as button and toggle                  | 70ms  |     |
> | `duration-fast-02`     | Micro-interactions such as fade                               | 110ms |     |
> | `duration-moderate-01` | Micro-interactions, small expansion, short distance movements | 150ms |     |
> | `duration-moderate-02` | Expansion, system communication, toast                        | 240ms |     |
> | `duration-slow-01`     | Large expansion, important system notifications               | 400ms |     |
> | `duration-slow-02`     | Background dimming                                            | 700ms |     |
