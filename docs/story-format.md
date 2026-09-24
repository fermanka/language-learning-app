# Free writing ("Історія"): file format (for the teacher)

Decision record: `docs/adr/0005-free-writing-story.md`.

## What it is

An optional task at the very end of a lesson's practice (after the extra practice). The teacher gives a **topic**; the learner writes a short connected story of her own in a text field; the teacher checks it for mistakes and for how well it hangs together. There is no automatic marking, and it does not count towards a lesson's 100%.

## Where the files go

In the learner's **private data folder**, never in this repository:

```
<data folder>/stories/nl/les-11.json     <- the topic shown at the end of the practice of Les 11
<data folder>/written/                   <- what the learner wrote (the page writes here, the teacher reads)
```

One topic file per lesson. Write the whole file each time (replace, do not patch). When the file is missing, nothing is shown. Do not write into `written/`, `progress/` or `recordings/`.

## The topic file

```json
{
  "lesson": "nl-les-11",
  "topic_ua": "Історія про сир",
  "topic_nl": "Een verhaal over kaas",
  "note_ua": "Optional text shown under the title (replaces the default hint).",
  "min_sentences": 5,
  "targets_ua": ["Optional short checklist item", "Optional short checklist item"]
}
```

- `lesson` must match the file name. `topic_ua` and `min_sentences` (a whole number, 3 to 15) are required; the rest is optional.
- The checklist is meant to be 2-3 items (more than 4 gives a warning). Items are hints, not conditions: the learner can send without ticking anything.
- Suggested minimum by stage: lessons 11-14 five sentences, lessons 15-17 six to eight, from Les 18 eight to ten. Tense: present only, until the teacher decides otherwise.

A valid example: `docs/story-example/stories/nl/les-11.json`. Check a folder with `npm run validate:story -- <path to the data folder>`.

## What the learner sends

The **Надіслати** button is locked until the text has `min_sentences` sentences (counted by the closing marks `.`, `!`, `?`). Every sending is a new text file, never overwritten:

```
written/nl-les-11.2026-09-24T14-25-47.txt     <- the topic on the first line, then her text
```

and one event `story_submitted` (lesson, file, number of sentences) goes into the progress log. The teacher's digest (`npm run digest -- <progress folder>`) lists every sending under "Written stories"; the teacher reads the file itself. An unsent draft is kept in the browser only.
