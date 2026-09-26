# Tenses tab: file format (for the teacher)

Decision record: `docs/adr/0006-tenses-tab.md`. Example files: `docs/verbs-example/`.

## Where the files go

Two files in `content/nl/` of this repository (public, like the lessons). The teacher writes them as drafts (`drafts/tenses.json`, `drafts/verbs.json` in the private workspace); the developer checks them with `npm run validate:verbs -- <folder>` and copies them into `content/nl/`. Until both files exist the tab "Часи" is simply not shown.

The page never guesses a form. Every Dutch word in the table comes from these two files; the page only puts them into the templates. A wrong form can therefore only be a wrong entry here, and the field `check` marks it for a native speaker.

## `tenses.json`

```json
{
  "intro_ua": "Short text above the table (Ukrainian).",
  "points_ua": ["Optional short points under the table (Ukrainian)."],
  "persons": [ {"id": "ik", "label": "ik"}, {"id": "jij", "label": "jij / je"}, {"id": "hij", "label": "hij / zij / het"},
               {"id": "wij", "label": "wij / we"}, {"id": "jullie", "label": "jullie"}, {"id": "zij", "label": "zij / ze"} ],
  "aux": {
    "hebben": { "inf": "hebben", "present": { "ik": "...", "jij": "...", "hij": "...", "wij": "...", "jullie": "...", "zij": "..." }, "past": { ...six forms... } },
    "zijn":   { ... },
    "gaan":   { ... },
    "zullen": { ... }
  },
  "tenses": [
    { "id": "vtt", "name_nl": "voltooid tegenwoordige tijd", "abbr": "v.t.t.", "name_ua": "перфект",
      "template": "{aux.present} {ptc}", "formula_ua": "hebben/zijn + дієприкметник",
      "freq_ua": "дуже часто в розмові", "since_lesson": 32 }
  ]
}
```

- `persons`: always these six ids in this order; only the `label` shown in the column header is yours. The columns are the six persons, the page has no separate column for `u`.
- `aux`: the four auxiliary verbs the templates use. `present` and `past` need all six persons; `inf` is the infinitive. `zullen.past` is the form used for `zou`.
- `tenses`: one row of the table each, in this order. `since_lesson` is the number of the lesson that first teaches the tense, or `null` when it is not taught yet. A tense is shown normally once that lesson is marked done, and greyed out ("пізніше") before that.
- `name_nl`, `abbr` (optional), `name_ua`, `formula_ua`, `freq_ua` are texts shown under the tense name.

### Template slots

A template is text with slots in braces. The result is one cell: the verb group WITHOUT the pronoun (the column header has it).

| Slot | Meaning |
|---|---|
| `{verb.present}` `{verb.past}` | the finite form of the chosen verb for this person (without the separable prefix) |
| `{prefix}` | the separable prefix of the verb, or nothing |
| `{ptc}` | the participle (whole, with its `ge-`) |
| `{inf}` | the infinitive (whole) |
| `{aux.present}` `{aux.past}` `{aux.inf}` | the chosen verb's OWN auxiliary (hebben or zijn) |
| `{hebben.present}` `{zijn.past}` `{gaan.present}` `{zullen.past}` ... | a fixed auxiliary, with `.present`, `.past` or `.inf` |

Examples: present `{verb.present} {prefix}` gives `sta op`; perfect `{aux.present} {ptc}` gives `ben opgestaan`; future `{gaan.present} {inf}` gives `ga opstaan`; conditional `{zullen.past} {inf}`; a rare tense `{zullen.present} {ptc} {aux.inf}` gives `zal opgestaan zijn`.

## `verbs.json`

```json
{
  "default": "werken",
  "chips": ["gaan", "eten", "opstaan"],
  "verbs": [
    { "inf": "opstaan", "ua": "вставати", "aux": "zijn",
      "present": { "ik": "sta", "jij": "staat", "hij": "staat", "wij": "staan", "jullie": "staan", "zij": "staan" },
      "past":    { "ik": "stond", "jij": "stond", "hij": "stond", "wij": "stonden", "jullie": "stonden", "zij": "stonden" },
      "ptc": "opgestaan", "prefix": "op",
      "check": "Optional reason (Ukrainian, up to 240 characters) why a form is not verified." }
  ]
}
```

- `default`: the verb shown when the tab opens. `chips`: up to four verbs shown as quick buttons next to the field (a good set shows contrasts, for example a regular verb, an irregular one, a `zijn` verb, a separable one).
- Every form is written out in full, also the regular ones. Nothing is derived by a rule.
- `present` and `past`: six forms each, WITHOUT the separable prefix. A separable verb has `prefix` (`op`), the infinitive `opstaan` and the participle `opgestaan` whole. The prefix goes to the end of the verb group in a main clause (`sta op`); the page does this through the template.
- `aux`: `hebben` or `zijn`. `ua`: short gloss, at most 80 characters.
- `check`: optional. The page shows a small "?" next to the verb with this reason.
- A verb the learner types that is not in this list is refused with a message. To add a verb, add an entry here.

## Checks

`npm run validate:verbs -- <folder>` (or `npm test`) reports missing forms, unknown template slots, an unknown auxiliary, a `default` or chip that is not in the list, a prefix that does not open the infinitive, and duplicates.
