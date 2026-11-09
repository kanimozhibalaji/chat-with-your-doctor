import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

// Ensure temporary uploads directory exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
    try {
        fs.mkdirSync(uploadDir, { recursive: true });
    } catch (e) {
        console.error("Failed to create upload dir:", e.message);
    }
}

const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf"
]);

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);

const storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, uploadDir);
    },
    filename: function (req, file, callback) {
        // Prevent path traversal and filename collision by generating random UUID + sanitized extension
        const ext = path.extname(file.originalname || "").toLowerCase();
        const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : ".dat";
        const uniqueName = `${Date.now()}-${crypto.randomUUID()}${safeExt}`;
        callback(null, uniqueName);
    }
});

const fileFilter = (req, file, callback) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (ALLOWED_MIME_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
        callback(null, true);
    } else {
        callback(new Error("Unsupported file type. Only JPG, PNG, WEBP and PDF documents are allowed."), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit to prevent DoS
    },
    fileFilter: fileFilter
});

export default upload;