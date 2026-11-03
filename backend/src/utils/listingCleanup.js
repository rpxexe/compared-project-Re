const { Property, Review, PropertyRating, PropertyView, Lead } = require("../models");

// Deletes an app-posted listing with its reviews, rating and view rows. Open CRM leads on it are
// closed as lost rather than deleted, so their history stays.
async function removeListing(doc) {
  await Property.deleteOne({ _id: doc._id });
  await Promise.all([
    Review.deleteMany({ property: doc._id }),
    PropertyRating.deleteMany({ property: doc._id }),
    PropertyView.deleteMany({ property: doc._id }),
    Lead.updateMany(
      { property: doc._id, status: { $nin: ["won", "lost"] } },
      { $set: { status: "lost", lostReason: "listing_removed" } },
    ),
  ]);
}

module.exports = { removeListing };
