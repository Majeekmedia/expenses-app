/** Domain types for Majeek Expenses. */

export interface Category {
  id: number;
  name: string;
  /** Hex colour used by chips and the donut. */
  color: string;
  /** Semantic icon key — mapped to an SVG in `components/category-icon.tsx`, never an emoji. */
  icon: string;
  sort: number;
  archived: boolean;
}

export interface Expense {
  id: number;
  /** Integer, in the minor unit of `currency`. Never a float. */
  amountMinor: number;
  categoryId: number;
  /** Local calendar day, `'YYYY-MM-DD'`. */
  spentOn: string;
  note: string;
  /** ISO 4217 code this amount was entered in. */
  currency: string;
  createdAt: string;
  updatedAt: string;
}

/** A row joined with its category, which is what the list renders. */
export interface ExpenseWithCategory extends Expense {
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
}

export interface CategoryTotal {
  categoryId: number;
  name: string;
  color: string;
  icon: string;
  totalMinor: number;
  count: number;
}

export interface DayTotal {
  spentOn: string;
  totalMinor: number;
}

export interface MonthSummary {
  month: string;
  totalMinor: number;
  count: number;
  byCategory: CategoryTotal[];
  byDay: DayTotal[];
  /** Largest single expense, used for the "biggest" line on the stats screen. */
  largestMinor: number;
  currency: string;
}

export interface Settings {
  currency: string;
  /** Monthly cap in minor units of `currency`; `0` means "no budget set". */
  monthlyBudgetMinor: number;
}
