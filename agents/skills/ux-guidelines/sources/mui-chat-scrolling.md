# Scrolling

Source: <https://mui.com/x/react-chat/behavior/scrolling/>

Retrieved: 2026-11-09

MUI X documentation; the page states no licence. Excerpts only, quoted for the guidelines items that cite this page; the page itself has the rest.

---

> The message list automatically scrolls to the bottom when:
>
> - The user sends a new message (always active, regardless of configuration).
> - New messages arrive from the assistant while the user is near the bottom.
>
> The auto-scroll behavior is gated by a **buffer**—if the user has scrolled more than `buffer` pixels away from the bottom, automatic scrolling pauses so the user can read earlier messages without interruption. The same buffer defines the bottom zone for the message list's `onReachBottom` callback, which fires once each time the viewport enters it.
