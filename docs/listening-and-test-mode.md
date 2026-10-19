# Listening exercise and test mode

Both are fields of a normal lesson `practice` exercise.

## Listening (`"type": "listening"`)

```json
{ "type": "listening", "instruction_ua": "Послухай новину і дай відповіді.",
  "audio": "hr-les-47-news.mp3", "audio_text": "Full text of the recording.",
  "items": [ { "prompt": "Питання українською?", "accepted": ["answer", "alt answer"] } ] }
```

- The learner hears the recording; the text stays hidden until she presses "Показати текст".
- Answers are typed like in a translate exercise. 3-8 items (size rule `listening`, overridable in config `size_rules`).
- `audio_text` is level-audited and voiced by `gen-audio.js` (file name is the `audio` value).

## Test mode (`"test": true` on any exercise)

After "Перевірити" the learner sees the score and red/green fields, but the correct answers are not shown.
Used for mini-tests (Lekcija 48 and later). "Спробувати ще" still clears the fields.
