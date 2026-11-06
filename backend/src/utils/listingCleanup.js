const fs = require("fs");
const path = require("path");
const { Property, Review, PropertyRating, PropertyView } = require("../models");
const { escapeRegex } = require("./validate");
const env = require("../config/env");

// Lazily, so this module doesn't pull in the upload route (and sharp) on its own.
const uploads = () => require("../routes/uploads");

const IMAGE_FIELDS = ["coverImage", "galleryImages", "images", "image"];

// The stored file names (<uuid>.jpg) of this API's own uploads referenced by a listing. Only a
// strict file-name pattern is accepted, so a crafted URL can never point outside the uploads folder.
function uploadedFiles(doc) {
  const names = new Set();
  const visit = (v) => {
    if (!v) return;
    if (Array.isArray(v)) return v.forEach(visit);
    if (typeof v === "object") return visit(v.url);
    if (typeof v !== "string") return;
    let pathname;
    try { pathname = new URL(v).pathname; } catch { return; }
    const m = /^\/uploads\/([^/]+)$/.exec(pathname);
    if (m && uploads().STORED_NAME.test(m[1])) names.add(m[1]);
  };
  IMAGE_FIELDS.forEach((f) => visit(doc?.[f]));
  return [...names];
}

// Another listing may point at the same uploaded photo (URLs are just strings); its file stays.
async function usedElsewhere(name, exceptId) {
  const re = new RegExp(`/uploads/${escapeRegex(name)}(?:$|[?#])`);
  const count = await Property.countDocuments({
    $and: [{ _id: { $ne: exceptId } }, { $or: IMAGE_FIELDS.flatMap((f) => [{ [f]: re }, { [`${f}.url`]: re }]) }],
  });
  return count > 0;
}

// Deletes this listing's uploaded photos. Missing files are fine (already gone) and a file that
// can't be removed never undoes the listing deletion - it is only logged.
async function removeUploadedFiles(doc) {
  const dir = uploads().UPLOAD_DIR;
  let removed = 0;
  for (const name of uploadedFiles(doc)) {
    try {
      if (await usedElsewhere(name, doc._id)) continue;
      await fs.promises.unlink(path.join(dir, name));
      removed += 1;
    } catch (e) {
      if (e?.code !== "ENOENT" && !env.isTest) console.error(`Could not delete upload ${name}: ${e?.code || e?.message}`);
    }
  }
  return removed;
}

// Deletes an app-posted listing with its reviews, rating, view rows and uploaded photos.
async function removeListing(doc) {
  await Property.deleteOne({ _id: doc._id });
  await Promise.all([
    Review.deleteMany({ property: doc._id }),
    PropertyRating.deleteMany({ property: doc._id }),
    PropertyView.deleteMany({ property: doc._id }),
  ]);
  await removeUploadedFiles(doc);
}

module.exports = { removeListing, removeUploadedFiles, uploadedFiles };
