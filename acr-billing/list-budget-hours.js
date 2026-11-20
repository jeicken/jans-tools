const { listBudgetHours } = require('./sum-budget-hours');

const [fileName, ...extraArgs] = process.argv.slice(2);
try {
  if (fileName === undefined || extraArgs.length > 0) {
    throw new Error('Usage: npm run list-budget-hours -- <csv-filename>');
  }
  const budgets = listBudgetHours(fileName);
  console.log('Budget\tHours');
  for (const { budget, hours } of budgets) {
    console.log(`${budget}\t${hours}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
