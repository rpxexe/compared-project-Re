// Standard reducing-balance home-loan maths. Inputs: amounts in ₹, annual rate in %,
// tenure in years. All results are estimates; lenders apply their own rules.

const monthlyRate = (annualPct) => Number(annualPct) / 12 / 100;

export function emi(principal, annualPct, years) {
  const p = Number(principal);
  const n = Math.round(Number(years) * 12);
  const r = monthlyRate(annualPct);
  if (!(p > 0) || !(n > 0) || !(r >= 0)) return 0;
  if (r === 0) return p / n;
  const f = (1 + r) ** n;
  return (p * r * f) / (f - 1);
}

export function loanSummary(principal, annualPct, years) {
  const monthly = emi(principal, annualPct, years);
  const months = Math.round(Number(years) * 12);
  const total = monthly * months;
  return { emi: monthly, totalPayable: total, totalInterest: Math.max(0, total - Number(principal || 0)) };
}

// Banks typically cap all EMIs at ~50% of net monthly income (FOIR). We use that common
// rule of thumb and label the result as an estimate in the UI.
export const FOIR = 0.5;

export function eligibleLoan(monthlyIncome, existingEmis, annualPct, years) {
  const capacity = Number(monthlyIncome) * FOIR - Number(existingEmis || 0);
  const n = Math.round(Number(years) * 12);
  const r = monthlyRate(annualPct);
  if (!(capacity > 0) || !(n > 0) || !(r >= 0)) return { maxEmi: 0, maxLoan: 0 };
  const maxLoan = r === 0 ? capacity * n : (capacity * ((1 + r) ** n - 1)) / (r * (1 + r) ** n);
  return { maxEmi: capacity, maxLoan };
}
