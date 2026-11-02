// Owner editing of app-posted ("manual") listings. Edits are validated by the same `parse` as
// POST /post-property, by merging the patch onto the stored values, so the rules never drift.
// Location, BHK, property type and category are fixed once a listing is posted.

const LOCKED = ["city", "locality", "address", "propertyType", "bhk", "category"];

// Stored listing -> the request shape `parse` expects (what the post-property form sends).
function editableFromDoc(doc) {
  const area = doc.area && typeof doc.area === "object" ? doc.area.value : doc.area;
  return {
    title: doc.title || "",
    city: doc.city || "",
    locality: doc.locality || "",
    propertyType: doc.propertyType || "",
    bhk: doc.bhk || "",
    category: doc.category || "",
    listingType: doc.listingType || "",
    price: doc.price ?? "",
    area: area ?? "",
    description: doc.description || "",
    bathrooms: doc.bathrooms ?? "",
    parking: doc.parkings ?? "",
    furnishing: doc.furnishing || "",
    facing: doc.facing || "",
    floor: doc.floor || "",
    totalFloors: doc.totalFloors ?? "",
    possessionStatus: doc.possessionStatus || "",
    ageOfProperty: doc.ageOfProperty || "",
    amenities: doc.amenities || [],
    facilities: doc.facilities || [],
    buildingGrade: doc.buildingGrade || "",
    highlights: doc.highlights || [],
    images: doc.galleryImages || (doc.coverImage ? [doc.coverImage] : []),
    contactName: doc.contactName || "",
    contactPhone: doc.contactPhone || "",
  };
}

// Locked keys present in a patch with a different value than stored.
function lockedChanges(doc, patch) {
  const current = editableFromDoc(doc);
  return LOCKED.filter((k) => patch[k] !== undefined && String(patch[k]).trim() !== String(current[k] ?? doc[k] ?? "").trim());
}

const isOwnManual = (doc, userId) => !!doc && doc.dataSource === "manual" && String(doc.ownerUserId) === String(userId);

module.exports = { LOCKED, editableFromDoc, lockedChanges, isOwnManual };
