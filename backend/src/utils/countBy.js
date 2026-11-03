// Number of documents per value of `field`, for the given values: Map(String(value) -> count).
async function countBy(Model, field, values, extra = {}) {
  if (!values.length) return new Map();
  const rows = await Model.aggregate([
    { $match: { ...extra, [field]: { $in: values } } },
    { $group: { _id: `$${field}`, n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

module.exports = { countBy };
