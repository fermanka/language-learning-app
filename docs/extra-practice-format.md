# Extra practice: file format (for the teacher)

Decision record: `docs/adr/0004-extra-practice-from-the-teacher.md`.

## Where the file goes

In the learner's **private data folder**, never in this repository:

```
<data folder>/extra/nl/les-05.json     <- extra practice shown at the end of the practice of Les 5
<data folder>/extra/nl/les-06.json
```

One file per lesson, from Les 5 on. Write the whole file each time (replace, do not patch). The page reads it whenever the lesson is opened; when the file is missing, nothing is shown. The learner's own folder is normally `language-app-data` next to the app.

Do not write into `progress/` or `recordings/`. Read `progress/` (or the digest, `npm run digest -- <progress folder>`) to see what she missed; answers to extra exercises appear there as `extra <id>`.

## The file

```json
{
  "lesson": "nl-les-05",
  "note_ua": "Optional one or two lines shown above the exercises.",
  "exercises": [
    { "id": "verbs-1", "type": "verbform", "instruction_ua": "...", "items": [ ... ] }
  ]
}
```

- `lesson` must match the file name (`nl-les-05` for `les-05.json`).
- 10 to 20 items in total (not counting `"example": true` rows). Fewer or more is a warning, not an error.
- Every exercise has an `id`: lowercase letters, digits and dashes, unique in the file. **Keep an id when you keep the exercise** (or change only its wording), so her answer history stays attached to it. A new exercise gets a new id.
- Allowed types: `translate`, `transform`, `verbform`, `gaps`, `matching`. Not `dictation`.
- Every sentence must stay inside the vocabulary of lessons 1..N for `les-NN.json` (the level audit checks this).

## Exercise shapes

They are the same as in the lesson files in `content/nl/lessons/`. An item with `"example": true` is shown already solved.

| type | exercise fields | item fields |
|---|---|---|
| `translate` | `instruction_ua`, `items` | `prompt` (Ukrainian), `accepted` (list of Dutch answers) |
| `transform` | `instruction_ua`, `items` | `prompt` (Dutch), `cue` (what to change), `accepted` |
| `verbform` | `instruction_ua`, `items` | `text` with exactly one `___`, `cue` (the infinitive, **required**: it is the only hint on screen), `accepted` |
| `gaps` | `instruction_ua`, `bank` (list of words), `items` | `text` with `___`, `hint`, `accepted` = one list of answers per `___` |
| `matching` | `instruction_ua`, `items`, optional `extra` (spare answers) | `prompt`, `answer` |

`translate` shows only the prompt: no hint in brackets. Put the grammar point in `instruction_ua` if the learner needs to know it.

A complete, valid example (sentences copied from Les 1, only to show the structure): `docs/extra-practice-example/extra/nl/les-05.json`.

## Checking a file

The checker needs a shell. Ask whoever has one (Nora) to run, from the app repo:

```
npm run validate:extra -- <path to the data folder>
```

It reports structural errors and any word outside the vocabulary learned so far.
