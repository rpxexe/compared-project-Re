const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const env = require("../config/env");
const { authRequired } = require("../middleware/auth");
const { rateLimit, byUser } = require("../utils/rateLimit");
const { bad } = require("../utils/errors");

const router = express.Router();

// Listing photos live on local disk and are served at /uploads (see app.js). Fine for a single
// server; move to object storage (S3, Cloudinary) before running more than one instance.
const UPLOAD_DIR = path.join(__dirname, "../../uploads");
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
// Every upload is re-encoded to one format: a JPEG with no metadata, at most this many pixels wide/high.
const OUTPUT_EXT = ".jpg";
const MAX_DIMENSION = 2560;
// Decompression-bomb guard: refuse images claiming more pixels than a 108 MP camera produces.
const MAX_INPUT_PIXELS = 120_000_000;
// Stored names are always <uuid>.jpg (older uploads may be .png/.webp); used by listing cleanup.
const STORED_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

// The client's Content-Type is only a claim, so the file's first bytes must agree.
const SIGNATURES = {
  ".jpg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  ".png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  ".webp": (b) => b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
};
const SHARP_FORMATS = { ".jpg": "jpeg", ".png": "png", ".webp": "webp" };

// Kept in memory (max 8 MB, one file): the original bytes are never written to the public
// uploads folder - only the re-encoded image is.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1, fields: 0 },
  fileFilter: (req, file, cb) =>
    TYPES[file.mimetype] ? cb(null, true) : cb(bad("Only JPEG, PNG or WebP images can be uploaded")),
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  message: "Too many uploads. Please try again later.",
  key: byUser,
});

function receive(req, res, next) {
  upload.single("image")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") return next(bad("Images must be 8 MB or smaller"));
    if (err instanceof multer.MulterError) return next(bad("Upload one image in the \"image\" field"));
    return next(err);
  });
}

// Decodes the upload and writes a fresh JPEG: EXIF (including GPS position), XMP, IPTC and ICC
// metadata and any trailing payload are dropped, the photo is turned upright using its EXIF
// orientation first, transparency is flattened onto white and oversized photos are scaled down.
async function reencode(buffer, ext) {
  const input = sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
  const meta = await input.metadata();
  if (meta.format !== SHARP_FORMATS[ext]) throw bad("That file isn't a valid image");
  return input
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

router.post("/", authRequired, uploadLimiter, receive, async (req, res) => {
  if (!req.file) throw bad("Choose an image to upload");
  const ext = TYPES[req.file.mimetype];
  if (!SIGNATURES[ext](req.file.buffer)) throw bad("That file isn't a valid image");
  let output;
  try {
    output = await reencode(req.file.buffer, ext);
  } catch (e) {
    if (e.status) throw e;
    throw bad("That file isn't a valid image");
  }
  // Never derived from the client's file name.
  const filename = `${crypto.randomUUID()}${OUTPUT_EXT}`;
  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), output, { flag: "wx" });
  const base = env.publicUrl || `${req.protocol}://${req.get("host")}`;
  res.status(201).json({ url: `${base}/uploads/${filename}` });
});

module.exports = router;
module.exports.UPLOAD_DIR = UPLOAD_DIR;
module.exports.STORED_NAME = STORED_NAME;
