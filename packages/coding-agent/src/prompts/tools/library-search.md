Search the lore library for a file matching a plain-language reference — a creator name, a lore topic, a world or character name — when the user names it in conversation instead of handing you a literal path.

Matching: file name first (case-insensitive, punctuation-insensitive). If no file name matches, it falls back to a content match inside each entry. Pass `library: "voices"` for a creator's voice profile, `library: "lore"` for a topic or world reference, or omit it (defaults to `"any"`) when you are not sure which.

The result is a list of **candidates**, never a resolved file. Even a single candidate needs the user's confirmation before you read it or treat it as settled. Zero candidates means report that nothing was found and ask how to proceed — do not pick the closest thing and continue.

This is the one sanctioned way to search the library. Do not fall back to raw file globbing or reading against the library instead of this tool.
