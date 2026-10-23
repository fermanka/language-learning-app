// Free writing ("Історія"): the teacher gives a topic for a lesson, the learner writes a short connected story of her own.
// The topic file lives in the learner's PRIVATE data folder (stories/<lang>/les-NN.json), the page only reads it.
// What she writes is saved as a text file in the same folder (written/), so the teacher can read it. Format: docs/story-format.md
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Story = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const str = (v) => typeof v === 'string' && v.trim() !== '';

  // Returns { errors, warnings }. Errors mean the page must not show the block.
  function validateStory(data, lessonId) {
    const errors = [], warnings = [];
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { errors: ['the file is not a JSON object'], warnings };
    if (data.lesson !== lessonId) errors.push(`"lesson" is ${JSON.stringify(data.lesson)}, expected "${lessonId}"`);
    if (!str(data.topic_ua)) errors.push('"topic_ua" is missing (the topic in Ukrainian, shown as the title)');
    if (data.topic_nl !== undefined && !str(data.topic_nl)) errors.push('"topic_nl" must be a non-empty string when present');
    if (data.note_ua !== undefined && !str(data.note_ua)) errors.push('"note_ua" must be a non-empty string when present');
    // the length is asked in sentences (a short story) or in words (a letter, a description): one of the two
    if (data.min_words !== undefined) {
      if (!Number.isInteger(data.min_words) || data.min_words < 20 || data.min_words > 400) errors.push('"min_words" must be a whole number from 20 to 400');
    } else if (!Number.isInteger(data.min_sentences) || data.min_sentences < 3 || data.min_sentences > 15) errors.push('"min_sentences" must be a whole number from 3 to 15 (or give "min_words" instead)');
    // timed writing: a countdown that starts when she starts writing; soft by default, "strict": true locks the text at zero
    if (data.minutes !== undefined && (!Number.isInteger(data.minutes) || data.minutes < 3 || data.minutes > 90)) errors.push('"minutes" must be a whole number from 3 to 90');
    if (data.strict !== undefined && typeof data.strict !== 'boolean') errors.push('"strict" must be true or false');
    if (data.strict && data.minutes === undefined) errors.push('"strict" needs "minutes"');
    if (data.kind_ua !== undefined && !str(data.kind_ua)) errors.push('"kind_ua" must be a non-empty string when present');
    if (data.targets_ua !== undefined && !(Array.isArray(data.targets_ua) && data.targets_ua.length > 0 && data.targets_ua.every(str))) errors.push('"targets_ua" must be a non-empty list of strings when present');
    else if (Array.isArray(data.targets_ua) && data.targets_ua.length > 4) warnings.push('more than 4 targets: the checklist is meant to be short');
    return { errors, warnings };
  }

  // Sentences are counted by their closing mark (. ! ? or ...); a piece with no letter in it does not count.
  function countSentences(text) {
    return String(text || '').split(/[.!?\u2026]+/).filter((piece) => /\p{L}/u.test(piece)).length;
  }

  // Words are counted by letters: a piece with a letter in it is a word, so a number or a dash on its own is not.
  function countWords(text) {
    return String(text || '').split(/\s+/).filter((piece) => /\p{L}/u.test(piece)).length;
  }

  // The teacher's feedback on a sent text: feedback/<lang>/les-NN.json. Returns { errors, warnings }.
  function validateFeedback(data, lessonId) {
    const errors = [], warnings = [];
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { errors: ['the file is not a JSON object'], warnings };
    if (data.lesson !== lessonId) errors.push(`"lesson" is ${JSON.stringify(data.lesson)}, expected "${lessonId}"`);
    if (!str(data.summary_ua)) errors.push('"summary_ua" is missing (the overall comment in Ukrainian)');
    for (const k of ['for_file', 'praise_ua', 'next_ua']) if (data[k] !== undefined && !str(data[k])) errors.push(`"${k}" must be a non-empty string when present`);
    if (data.mistakes !== undefined) {
      if (!Array.isArray(data.mistakes)) errors.push('"mistakes" must be a list');
      else {
        data.mistakes.forEach((m, i) => {
          if (!m || !str(m.wrong) || !str(m.right)) errors.push(`mistakes[${i}] needs "wrong" and "right"`);
          else if (m.why_ua !== undefined && !str(m.why_ua)) errors.push(`mistakes[${i}].why_ua must be a non-empty string when present`);
        });
        if (data.mistakes.length > 12) warnings.push('more than 12 mistakes: pick the ones that matter most');
      }
    }
    return { errors, warnings };
  }

  // nl-les-11 -> stories/nl/les-11.json
  function storyLocation(lessonId) {
    const m = /^([a-z]{2})-(les-\d+)$/.exec(lessonId || '');
    return m ? { lang: m[1], file: `${m[2]}.json` } : null;
  }

  return { validateStory, validateFeedback, countSentences, countWords, storyLocation };
});
