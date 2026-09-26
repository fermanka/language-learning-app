// Checks the two data files of the tenses tab: <dir>/tenses.json and <dir>/verbs.json. Format: docs/tenses-format.md
// Usage: node scripts/validate-verbs.js <dir> [--optional]
// With --optional a missing pair of files is fine (the tab is simply not shown yet); a half-present pair is an error.
const fs = require('fs');
const path = require('path');
const { validate } = require('../mockup/tenses.js');

const dir = process.argv[2];
const optional = process.argv.includes('--optional');
if (!dir) { console.error('usage: node scripts/validate-verbs.js <dir> [--optional]'); process.exit(2); }

const files = ['tenses.json', 'verbs.json'].map((f) => path.join(dir, f));
const present = files.filter((f) => fs.existsSync(f));
if (present.length === 0) {
  if (optional) { console.log(`${dir}: no tenses.json / verbs.json yet, the tenses tab stays hidden`); process.exit(0); }
  console.error(`ERROR ${dir}: tenses.json and verbs.json not found`); process.exit(1);
}
if (present.length === 1) { console.error(`ERROR ${dir}: only ${path.basename(present[0])} exists, the tab needs both files`); process.exit(1); }

let data;
try { data = files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8'))); } catch (e) { console.error('ERROR not valid JSON: ' + e.message); process.exit(1); }
const { errors, warnings } = validate(data[0], data[1]);
warnings.forEach((w) => console.log('WARNING ' + w));
errors.forEach((e) => console.error('ERROR   ' + e));
if (errors.length) process.exit(1);
console.log(`${dir}: ok (${data[0].tenses.length} tenses, ${data[1].verbs.length} verbs)`);
