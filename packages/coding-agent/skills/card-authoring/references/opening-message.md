# The opening message

The Opening Message is the only box the user reads before deciding to stay. It is the highest-value prose in the card.

## What it must do

1. **Start in motion.** The scene is already happening. No "you wake up", no "you arrive at", no establishing paragraph before the first line of dialogue or action.
2. **Give `{{user}}` a place.** The user has a position in this scene — a seat, a task, a relationship to whoever is speaking. Not a role description; a place.
3. **End on a step-in.** The last beat is a moment the user can act in, not a resolved scene or a question that stalls.
4. **Survive the removal test.** Remove `{{user}}` and the message must play differently. If it plays the same, the user was never in it.
5. **Not lock the physical setup.** Do not fix the user's body, position, or clothing in the first message. The user may have arrived from somewhere else.
6. **Not dump backstory.** No multi-time-period summary, no "ten years ago" paragraph before the scene starts.

## The failure modes

| Failure | What it looks like |
|---|---|
| Empty scene | A location and a mood, nothing happening. |
| Backstory dump | The character recapping their life before the scene starts. |
| Rigid staging | The user's appearance and position pinned in the first line. |
| Guest star | A character named who does most of the talking, with the user on the sidelines. |
| Scene ends | The opening resolves itself instead of handing the user a moment. |

## Length

An opening message is a scene, not a summary. It should read like the first screen of a story, and it should be short enough that the user does not scroll past it.

## Checks

Read the message back against the six rules above, then run the macro check over it. A hook that references `{{user}}` incorrectly still lands wrong.
