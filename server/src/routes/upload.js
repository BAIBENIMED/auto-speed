const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Ensure uploads directory exists (backup check)
const uploadDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Formats acceptes : images (logos, photos de vehicules) et documents
// (connaissements, factures, passeports numerises, rapports d'expertise).
const TYPES_AUTORISES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

const TAILLE_MAX = parseInt(process.env.UPLOAD_MAX_MB || '15', 10) * 1024 * 1024;

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Le prefixe distingue un logo d'une piece jointe metier
        const prefixe = file.mimetype.startsWith('image/') ? 'img' : 'doc';
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${prefixe}-${unique}${path.extname(file.originalname).toLowerCase()}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || TYPES_AUTORISES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Format non supporté. Envoyez une image, un PDF, un document Word ou un tableur.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: TAILLE_MAX }
});

/**
 * POST /api/upload
 * Le champ s'appelait « logo » a l'origine ; « fichier » est accepte aussi
 * pour les pieces jointes metier, sans casser l'existant.
 */
router.post('/', upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'fichier', maxCount: 1 }]), (req, res) => {
    try {
        const fichier = ((req.files && (req.files.logo || req.files.fichier)) || [])[0];

        if (!fichier) {
            return res.status(400).json({ success: false, message: 'Aucun fichier téléchargé' });
        }

        // uploads est servi en statique depuis la racine du projet
        res.json({
            success: true,
            data: {
                url: `/uploads/${fichier.filename}`,
                filename: fichier.filename,
                originalName: fichier.originalname,
                mimeType: fichier.mimetype,
                size: fichier.size
            }
        });
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ success: false, message: 'Erreur lors du téléchargement' });
    }
});

// Un fichier trop lourd ou d'un type refuse doit expliquer pourquoi
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            success: false,
            message: `Fichier trop volumineux (maximum ${Math.round(TAILLE_MAX / 1024 / 1024)} Mo).`
        });
    }
    if (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
    next();
});

module.exports = router;
