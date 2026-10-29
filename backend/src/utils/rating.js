// Pure helpers for review summaries.
function summarise(reviews) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  for (const r of reviews) {
    const n = Math.round(Number(r.rating));
    if (n >= 1 && n <= 5) { distribution[n] += 1; total += n; }
  }
  const count = distribution[1] + distribution[2] + distribution[3] + distribution[4] + distribution[5];
  return { average: count ? Math.round((total / count) * 10) / 10 : 0, count, distribution };
}

const publicRating = (r) => (r && r.count > 0 ? { average: r.average, count: r.count } : null);

module.exports = { summarise, publicRating };
