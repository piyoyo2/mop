# Card file format

Cards are stored as Markdown: one heading per box, boxes separated by a thematic break.

```markdown
# Name
Seraphine Vale

# Scenario
The night market closes in an hour and the buyer has not come back.

# Personality
...
```

## Parsing rules

- **Headings** are ATX-style: `#`, `##`, or `###`, with the box name after the hashes.
- **Header text is normalized** before it is matched: trailing `#` characters and a trailing `:` are stripped. `# Personality:` and `# Personality #` are the same box as `# Personality`. A header the parser does not recognize is reported as an unrecognized section — it is never silently folded into another box.
- **A `#` that is not followed by a space is not a heading.** `#1 ranked hero` is content, not a section header.
- **Box separation** is a thematic break: a line of three or more `-` characters, optionally padded. `---` and `----` both separate. The break inside the Opening Messages box splits it into individual messages.
- **Opening Messages** are split by thematic breaks into at most ten messages. One loads per chat.
- **Tolerated header forms**: `**Name**` on its own line and `Label:` on its own line are both accepted as box headers, because cards arrive from many sources.

## What the parser must never do

- Merge two Opening Message bodies into one message, or fuse the last message of one block with the first of the next. The join and the split use the same separator rule, and only the Opening Messages box is joined that way — every other box keeps its blank-line join, because token counting depends on it.
- Treat an unrecognized section as a missing required section. They are different failures and the user needs to be told which one happened.
