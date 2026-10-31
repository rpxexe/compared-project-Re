const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const env = require("../config/env");
const { authRequired } = require("../middleware/auth");
const { bad } = require("../utils/errors");

const router = express.Router();

// Listing photos live on local disk and are served at /uploads (see app.js). Fine for a single
// server; move to object storage (S3, Cloudinary) before running more than one instance.
const UPLOAD_DIR = path.join(__dirname, "../../uploads");
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

// The client's Content-Type is only a claim, so the saved file's first bytes must agree.
const SIGNATURES = {
  ".jpg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  ".png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  ".webp": (b) => b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdir(UPLOAD_DIR, { recursive: true }, (err) => cb(err, UPLOAD_DIR));
    },
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${TYPES[file.mimetype]}`),
  }),
  limits: { fileSize: MAX_BYTES, files: 1, fields: 0 },
  fileFilter: (req, file, cb) =>
    TYPES[file.mimetype] ? cb(null, true) : cb(bad("Only JPEG, PNG or WebP images can be uploaded")),
});

function receive(req, res, next) {
  upload.single("image")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") return next(bad("Images must be 8 MB or smaller"));
    if (err instanceof multer.MulterError) return next(bad("Upload one image in the \"image\" field"));
    return next(err);
  });
}

async function hasSignature(file) {
  const fh = await fs.promises.open(file.path, "r");
  try {
    const { buffer } = await fh.read(Buffer.alloc(12), 0, 12, 0);
    return SIGNATURES[path.extname(file.filename)](buffer);
  } finally {
    await fh.close();
  }
}

router.post("/", authRequired, receive, async (req, res) => {
  if (!req.file) throw bad("Choose an image to upload");
  if (!(await hasSignature(req.file))) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    throw bad("That file isn't a valid image");
  }
  const base = env.publicUrl || `${req.protocol}://${req.get("host")}`;
  res.status(201).json({ url: `${base}/uploads/${req.file.filename}` });
});

module.exports = router;
module.exports.UPLOAD_DIR = UPLOAD_DIR;
