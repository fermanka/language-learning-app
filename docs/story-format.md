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
written/nl-les-11.2026-09-24T14-25-47-183.txt     <- the topic on the first line, then her text
```

and one event `story_submitted` (lesson, file, number of sentences) goes into the progress log. The teacher's digest (`npm run digest -- <progress folder>`) lists every sending under "Written stories"; the teacher reads the file itself. An unsent draft is kept in the browser only.

## Editing a story she already sent

Once a lesson has a sent story, the page shows it locked (read-only) with an **Редагувати** (Edit) button instead of the text field. Clicking it unlocks the box with what was last sent, pre-filled. Sending again asks her to choose:

- **Перезаписати** -- resaves under the SAME file name (an explicit overwrite: the old content at that name is gone), and still logs a new `story_submitted` event, so the digest shows the file was revised.
- **Зберегти обидва варіанти** -- the original behaviour: a brand new file, the old one untouched.
- **Скасувати** -- nothing is saved, the box stays open for more editing.

## Timed writing (letters, descriptions) and the teacher's feedback

The same topic file can ask for a **timed text** of a given length in words:

```json
{
  "lesson": "hr-les-52",
  "topic_ua": "Службовий лист",
  "topic_nl": "Poslovno pismo",
  "kind_ua": "Офіційний лист",
  "min_words": 80,
  "minutes": 20,
  "strict": false,
  "targets_ua": ["Pozdrav i oslovljavanje", "Razlog pisma", "Zahvala i završni pozdrav"]
}
```

- `min_words` (20-400) replaces `min_sentences` (one of the two is required). Words are counted by letters; a number or a dash on its own is not a word.
- `minutes` (3-90) switches on a countdown. It starts with the first keystroke (or the "Почати" button) and survives a page reload. It is **soft**: when time runs out the box stays open and the timer turns red ("Час вийшов"); with `"strict": true` the box locks at zero. Exam realism is the teacher's call.
- `kind_ua` is an optional label for the kind of text (shown in the hint).
- On sending, the text file starts with the topic and a line `Час: 18:42 з 20:00` (with "понад ліміт" when over), and the event `story_submitted` also carries `words`, `seconds` and `minutes`. The digest lists them: `(8 sentences, 92 words, 21:00 of 20 min, OVER the limit)`.

### Feedback file

After reading the sent text the teacher writes a feedback file, which appears under the task in the app:

```
<data folder>/feedback/hr/les-52.json
```

```json
{
  "lesson": "hr-les-52",
  "for_file": "hr-les-52.2026-10-27T10-15-30-120.txt",
  "summary_ua": "Overall comment in Ukrainian.",
  "praise_ua": "Optional: what worked.",
  "mistakes": [ { "wrong": "ja ide", "right": "ja idem", "why_ua": "Optional short reason." } ],
  "next_ua": "Optional: what to do next."
}
```

- `lesson` and `summary_ua` are required; at most 12 mistakes (a warning above that). Write the whole file each time. `for_file` is the `written/` file the feedback is about: when she has since sent a newer version, the page says the feedback is for the previous version.
- Check with `npm run validate:story -- <data folder>` (it checks both `stories/` and `feedback/`).
