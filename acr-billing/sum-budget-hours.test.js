const assert = require('node:assert/strict');
const { writeFileSync, rmSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { sumBudgetHours, listBudgetHours } = require('./sum-budget-hours');

function csvFile(t, content) {
  const file = `.billing-test-${randomUUID()}.csv`;
  writeFileSync(join(__dirname, file), content, { flag: 'wx' });
  t.after(() => rmSync(join(__dirname, file)));
  return file;
}

test('sums Duration for every matching row, including non-billable and uninvoiced rows', (t) => {
  const file = csvFile(t, '\uFEFFInvoice,Budget,Billable,Client Duration,Duration (h),Duration,Description\r\n'
    + '"RE1","Target, ""2026""",Yes,9:00,"9,00",1:45,"First line\r\nSecond line"\r\n'
    + ',"Target, ""2026""",No,8:00,"8,00",0:30,"More, work"\r\n'
    + 'RE2,Other,Yes,7:00,"7,00",7:00,Other\r\n'
    + 'Total,,,24:00,"24,00",9:15,\r\n');

  assert.equal(sumBudgetHours('Target, "2026"', file), 2.25);
});

test('sums minutes before conversion and supports durations over 24 hours', (t) => {
  const file = csvFile(t, 'Budget,Duration\nTarget,25:59\nTarget,0:01\n');
  assert.equal(sumBudgetHours('Target', file), 26);
});

test('returns zero for no exact budget match', (t) => {
  const file = csvFile(t, 'Budget,Duration\nTarget,1:00\n');
  assert.equal(sumBudgetHours('target', file), 0);
  assert.equal(sumBudgetHours('Missing', file), 0);
});

test('rejects empty budget names', () => {
  for (const name of ['', ' ', undefined, null]) {
    assert.throws(() => sumBudgetHours(name), /non-empty string/);
  }
});

test('rejects missing or duplicate required columns and malformed CSV', (t) => {
  for (const content of [
    '',
    'Budget,Duration (h)\nTarget,"1,00"\n',
    'Project,Duration\nTarget,1:00\n',
    'Budget,Duration,Duration\nTarget,1:00,2:00\n',
    'Budget,Duration\nTarget,"1:00\n',
    'Budget,Duration\nTarget,1:00,Extra\n',
  ]) {
    assert.throws(() => sumBudgetHours('Target', csvFile(t, content)));
  }
});

test('rejects invalid durations rather than producing partial or inaccurate totals', (t) => {
  for (const duration of ['', '1:60', '-1:00', '1.5', '1:5', '1:00:00', '999999999999999999:00']) {
    const file = csvFile(t, `Budget,Duration\nTarget,1:00\nTarget,${duration}\n`);
    assert.throws(() => sumBudgetHours('Target', file), /Invalid Duration|safe integer/);
  }
});

test('CLI prints numeric hours and reports input errors with a failing exit status', (t) => {
  const file = csvFile(t, 'Budget,Duration\nTarget,1:30\n');
  const script = join(__dirname, 'sum-budget-hours.js');
  const result = spawnSync(process.execPath, [script, 'Target', file], {
    encoding: 'utf8',
    cwd: tmpdir(),
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '1.5\n');
  assert.equal(result.stderr, '');

  for (const args of [[], ['Target'], ['Target', `${file}.missing`], ['Target', file, 'extra']]) {
    const failure = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    assert.equal(failure.status, 1);
    assert.equal(failure.stdout, '');
    assert.notEqual(failure.stderr, '');
  }
});

test('requires a filename in the repository root for both routines', () => {
  for (const file of [undefined, '', ' ', '../outside.csv', 'subdirectory/billings.csv', join(tmpdir(), 'outside.csv')]) {
    assert.throws(() => sumBudgetHours('Target', file), /filename is required|repository root/);
    assert.throws(() => listBudgetHours(file), /filename is required|repository root/);
  }
});

test('lists each budget once with summed Duration and excludes the export total', (t) => {
  const file = csvFile(t, 'Invoice,Budget,Billable,Duration,Description\n'
    + 'RE1,"Target, ""2026""",Yes,1:45,"First\nSecond"\n'
    + ',Other,No,25:59,Work\n'
    + ',"Target, ""2026""",No,0:30,Work\n'
    + ',Other,No,0:01,Work\n'
    + 'Total,,,28:15,\n');
  assert.deepEqual(listBudgetHours(file), [
    { budget: 'Target, "2026"', hours: 2.25 },
    { budget: 'Other', hours: 26 },
  ]);
  assert.deepEqual(listBudgetHours(csvFile(t, 'Budget,Duration\n')), []);
});

test('listing CLI accepts a filename and fails without partial output on invalid input', (t) => {
  const file = csvFile(t, 'Budget,Duration\nFirst,1:30\nSecond,2:15\nFirst,0:15\n');
  const script = join(__dirname, 'list-budget-hours.js');
  const result = spawnSync(process.execPath, [script, file], { encoding: 'utf8', cwd: tmpdir() });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'Budget\tHours\nFirst\t1.75\nSecond\t2.25\n');
  assert.equal(result.stderr, '');

  const invalidFile = csvFile(t, 'Budget,Duration\nFirst,1:00\nSecond,invalid\n');
  for (const args of [[], [file, 'extra'], [invalidFile], [`${file}.missing`]]) {
    const failure = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    assert.equal(failure.status, 1);
    assert.equal(failure.stdout, '');
    assert.notEqual(failure.stderr, '');
  }
});
