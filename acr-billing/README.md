# Billing hours by budget

Requires Node.js 22 or newer. Install dependencies with `npm install`.

```sh
npm run sum-budget-hours -- "AP2.2: MIRCo_Change management 2026" 2026-11-19-billings_okt.csv
```

The command prints the total as a number of decimal hours. The CSV filename is
required and must refer to a file directly in the repository root, not in a
subdirectory or outside the repository. It is resolved from the repository root,
regardless of the current working directory.

```sh
npm run sum-budget-hours -- "Budget name" ./billings.csv
```

List all budgets with their total hours:

```sh
npm run list-budget-hours -- billings.csv
```

This prints a tab-separated `Budget` / `Hours` table in first-appearance order,
with one row per budget. Rows without a budget (including the CSV's `Total`
summary row) are excluded to avoid double counting.

The `--` forwards the budget name and filename to the script. Add `--silent`
before `sum-budget-hours` to print only the numeric result.

Use the routine from JavaScript:

```js
const { sumBudgetHours, listBudgetHours } = require('./sum-budget-hours');

const hours = sumBudgetHours('Budget name', './billings.csv');
const budgets = listBudgetHours('billings.csv'); // [{ budget: 'Budget name', hours: 1.5 }]
```

Budget names match exactly (case-sensitive). All matching rows count,
regardless of Invoice, Billable, or Active values. Only `Duration` (`H:MM`)
is summed, not `Client Duration` or `Duration (h)`. Minutes are summed before
conversion to hours; durations can exceed 24 hours. An unmatched budget returns
`0`. Invalid inputs throw an error; command-line errors are printed to stderr
with a nonzero exit status.

The input is the provided comma-separated CSV export, not a binary Excel
workbook (`.xlsx`). Quoted commas, multiline descriptions, and UTF-8 BOMs are
supported.

Run tests with `npm test`.
