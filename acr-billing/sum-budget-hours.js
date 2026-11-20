const { readFileSync } = require('node:fs');
const { dirname, resolve } = require('node:path');
const { parse } = require('csv-parse/sync');

function budgetMinutes(fileName, budgetName) {
  if (typeof fileName !== 'string' || fileName.trim() === '') {
    throw new TypeError('CSV filename is required.');
  }
  const filePath = resolve(__dirname, fileName);
  if (dirname(filePath) !== __dirname) {
    throw new Error('CSV file must be in the repository root.');
  }

  const [headers = [], ...rows] = parse(readFileSync(filePath, 'utf8'), {
    bom: true,
    skip_empty_lines: true,
  });
  for (const column of ['Budget', 'Duration']) {
    if (headers.filter((header) => header === column).length !== 1) {
      throw new Error(`CSV must contain exactly one "${column}" column.`);
    }
  }

  const budgetIndex = headers.indexOf('Budget');
  const durationIndex = headers.indexOf('Duration');
  const totals = new Map();

  for (const [index, row] of rows.entries()) {
    const budget = row[budgetIndex];
    if (!budget || (budgetName !== undefined && budget !== budgetName)) continue;

    const duration = row[durationIndex];
    const match = /^(\d+):([0-5]\d)$/.exec(duration);
    if (!match) {
      throw new Error(
        `Invalid Duration "${duration}" in CSV record ${index + 2}; expected H:MM.`,
      );
    }

    const totalMinutes = (totals.get(budget) ?? 0) + Number(match[1]) * 60 + Number(match[2]);
    if (!Number.isSafeInteger(totalMinutes)) {
      throw new RangeError('Total duration exceeds the safe integer range in minutes.');
    }
    totals.set(budget, totalMinutes);
  }

  return totals;
}

function sumBudgetHours(budgetName, fileName) {
  if (typeof budgetName !== 'string' || budgetName.trim() === '') {
    throw new TypeError('Budget name must be a non-empty string.');
  }
  return (budgetMinutes(fileName, budgetName).get(budgetName) ?? 0) / 60;
}

function listBudgetHours(fileName) {
  return Array.from(budgetMinutes(fileName), ([budget, minutes]) => ({
    budget,
    hours: minutes / 60,
  }));
}

module.exports = { sumBudgetHours, listBudgetHours };

if (require.main === module) {
  const [budgetName, fileName, ...extraArgs] = process.argv.slice(2);
  try {
    if (budgetName === undefined || fileName === undefined || extraArgs.length > 0) {
      throw new Error('Usage: npm run sum-budget-hours -- "<budget name>" <csv-filename>');
    }
    console.log(sumBudgetHours(budgetName, fileName));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
