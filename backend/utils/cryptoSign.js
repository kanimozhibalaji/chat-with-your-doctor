import crypto from 'crypto';
import QRCode from 'qrcode';

/**
 * VitalSync Cryptographic Prescription Verification Service
 * 
 * Uses standard asymmetric cryptography (RSA-2048) and cryptographic hashing (SHA-256):
 * 1. Each Doctor is provisioned an RSA-2048 Key Pair.
 * 2. Prescriptions are deterministically canonicalized into an immutable payload.
 * 3. Payload is hashed with SHA-256 (fingerprint).
 * 4. Doctor signs the SHA-256 hash using their Private Key.
 * 5. Pharmacists / Patients can verify the signature using the Doctor's Public Key.
 * 6. Generates a secure QR Code pointing to public verification portal.
 */

// Derive 256-bit symmetric master key for encrypting doctor RSA private keys at rest (AES-256-GCM)
const getEnvelopeMasterKey = () => {
    const secret = process.env.KEY_ENCRYPTION_SECRET || process.env.JWT_SECRET || 'vitalsync-kms-envelope-fallback-secret';
    return crypto.createHash('sha256').update(String(secret)).digest();
};

// Encrypt Doctor's RSA-2048 Private Key PEM before storing in MongoDB (AES-256-GCM authenticated encryption)
export const encryptPrivateKey = (privateKeyPem) => {
    if (!privateKeyPem) return '';
    if (String(privateKeyPem).startsWith('enc:v1:')) return privateKeyPem;
    const key = getEnvelopeMasterKey();
    const iv = crypto.randomBytes(12); // 96-bit NIST-recommended GCM IV
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(privateKeyPem, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `enc:v1:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
};

// Decrypt Doctor's RSA-2048 Private Key PEM in-memory at signing time (gracefully supports legacy plaintext PEM)
export const decryptPrivateKey = (storedKey) => {
    if (!storedKey) return '';
    const str = String(storedKey);
    if (str.startsWith('-----BEGIN')) {
        return str;
    }
    if (!str.startsWith('enc:v1:')) {
        return str;
    }
    const parts = str.split(':');
    if (parts.length !== 5) {
        throw new Error('Malformed encrypted private key envelope');
    }
    const [, , ivB64, tagB64, cipherB64] = parts;
    const key = getEnvelopeMasterKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(cipherB64, 'base64')),
        decipher.final()
    ]);
    return decrypted.toString('utf8');
};

// Generate RSA-2048 key pair
export const generateDoctorKeyPair = () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    return { publicKey, privateKey };
};

// Canonicalize prescription to prevent formatting discrepancies
export const canonicalizePrescription = (prescription) => {
    const normalizedMedicines = (prescription.medicines || []).map(m => ({
        name: (m.name || '').trim().toLowerCase(),
        dosage: (m.dosage || '').trim().toLowerCase(),
        frequency: (m.frequency || '').trim().toLowerCase(),
        duration: (m.duration || '').trim().toLowerCase()
    })).sort((a, b) => a.name.localeCompare(b.name));

    const canonicalData = {
        appointmentId: String(prescription.appointmentId || ''),
        userId: String(prescription.userId || ''),
        docId: String(prescription.docId || ''),
        diagnosis: (prescription.diagnosis || '').trim().toLowerCase(),
        medicines: normalizedMedicines
    };

    return JSON.stringify(canonicalData);
};

// Compute SHA-256 hash
export const computeHash = (dataString) => {
    return crypto.createHash('sha256').update(dataString).digest('hex');
};

// Sign prescription with Doctor's private key
export const signPrescription = (canonicalDataString, privateKeyPem) => {
    const signer = crypto.createSign('SHA256');
    signer.update(canonicalDataString);
    signer.end();
    return signer.sign(privateKeyPem, 'base64');
};

// Verify prescription signature with Doctor's public key
export const verifySignature = (canonicalDataString, signatureBase64, publicKeyPem) => {
    try {
        const verifier = crypto.createVerify('SHA256');
        verifier.update(canonicalDataString);
        verifier.end();
        return verifier.verify(publicKeyPem, signatureBase64, 'base64');
    } catch (err) {
        console.error('Signature verification error:', err.message);
        return false;
    }
};

// Generate QR Code data URL containing verification data
export const generateQRCode = async (verificationUrl, prescriptionMeta) => {
    try {
        const qrPayload = JSON.stringify({
            url: verificationUrl,
            id: prescriptionMeta.prescriptionId,
            hash: prescriptionMeta.hash,
            doc: prescriptionMeta.doctorName
        });

        // Generate high quality QR code data URL
        const dataUrl = await QRCode.toDataURL(qrPayload, {
            errorCorrectionLevel: 'M',
            margin: 2,
            color: {
                dark: '#0f172a',
                light: '#ffffff'
            },
            width: 256
        });

        return dataUrl;
    } catch (err) {
        console.error('QR code generation error:', err);
        return '';
    }
};
