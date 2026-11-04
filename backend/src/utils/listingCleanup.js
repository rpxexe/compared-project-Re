const { Property, Review, PropertyRating, PropertyView } = require("../models");

// Deletes an app-posted listing with its reviews, rating and view rows.
async function removeListing(doc) {
  await Property.deleteOne({ _id: doc._id });
  await Promise.all([
    Review.deleteMany({ property: doc._id }),
    PropertyRating.deleteMany({ property: doc._id }),
    PropertyView.deleteMany({ property: doc._id }),
  ]);
}

module.exports = { removeListing };
