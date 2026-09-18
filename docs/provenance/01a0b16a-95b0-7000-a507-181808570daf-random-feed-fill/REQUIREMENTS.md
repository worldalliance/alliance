---
user: markzxu
task: Randomly expand the home feed's source-user set to 10 when friends+group members is smaller
---

- "currently the feed only shows activity from people you're friends with and people in your group. If that set is smaller than 10 people, I would like it to be randomly expanded to 10 people."
- Charles Lien: "May be different people every refresh, so the change can be stateless, if that makes implementation easier."
- Charles Lien, clarifying the "different people every refresh" note above: "i don't _want_ new people per refresh. only if it makes the implementation easier. and it seems like it's making it harder. let's use some MD5 hash or something?"
