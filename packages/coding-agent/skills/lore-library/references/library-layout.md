# Library layout

The lore library is the durable store. It outlives every card and every session.

## Where it lives

```
~/.mop/agent/lore/
```

## What goes where

```
~/.mop/agent/lore/
├── <topic>.md          topic notes: a character, a place, a faction, an idea
├── worlds/
│   └── <world>.md      a fully authored world
├── voices/
│   └── <creator>.md    a voice profile
└── ideas/
    └── <idea>.md       a saved concept, still a sketch
```

- The root holds topic notes. One file per topic.
- `worlds/` holds worlds. A world is a whole system, so it gets its own file rather than a root note.
- `voices/` holds voice profiles.
- `ideas/` holds concepts that have not been developed into a card yet.

Lorebook JSON files live alongside the notes they belong to, so a world and its lorebook stay together.

## Naming

kebab-case, descriptive, no dates, no version numbers: `the-ashveil-lineage.md`, `glass-hollow.md`.

A name that describes the content beats a name that describes the session it was written in.

## Format

Markdown, with a `#` heading naming the entry as its title, then the content. Enough structure that the entry is readable on its own — a library note you have to remember the context of is a library note you will not use.

## Searching

Use the library search tool with the user's own words. It matches filenames first, then falls back to full content, and returns candidates with a snippet — it never resolves a file for you.

**Always confirm the match with the user before reading or using a candidate.** If the search finds nothing, report that. Do not pick the closest thing and proceed.

## What never happens

- The library is never deleted from.
- An entry is never overwritten without the user asking for it.
- Nothing is saved into the library that the user did not ask to save.
