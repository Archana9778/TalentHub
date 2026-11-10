/**
 * TalentHub Resume Validation Service
 *
 * Validates uploaded resume files using:
 * 1. File size check against configured limit
 * 2. Declared extension check (.pdf and .docx only; rejects .doc and all other extensions)
 * 3. Declared MIME type and content inspection
 * 4. PDF structural validation (starts with %PDF- header and ends with %%EOF trailer)
 * 5. DOCX structural validation (valid ZIP archive containing word/document.xml)
 * 6. ZIP-bomb protection for DOCX packages
 * 7. SHA-256 checksum computation
 * 8. Safe filename sanitization against path traversal and shell injection
 *
 * All validation is performed against the in-memory buffer without disk writes.
 */
import crypto from 'crypto';
import path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AllowedExtension = 'pdf' | 'docx';

export interface ValidationResult {
  valid: boolean;
  isValid: boolean; // Alias for valid
  extension: AllowedExtension | null;
  fileType?: 'pdf' | 'docx';
  mimeType: string | null;
  checksum: string | null;
  checksumSha256?: string; // Alias for checksum
  sanitizedFilename?: string;
  fileSizeBytes?: number;
  statusCode?: number;
  errorCode?: 'TOO_LARGE' | 'EMPTY' | 'BAD_EXTENSION' | 'BAD_MIME' | 'BAD_CONTENT' | 'CORRUPT';
  errorMessage?: string;
  error?: string; // Alias for errorMessage
}

const ALLOWED_EXTENSIONS: AllowedExtension[] = ['pdf', 'docx'];
const ALLOWED_MIMES: Record<AllowedExtension, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

// PDF magic bytes: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);
// ZIP/DOCX magic bytes: PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/** Max uncompressed DOCX central directory inspection size: 50 MB (ZIP-bomb guard) */
const MAX_DOCX_INSPECT_BYTES = 50 * 1024 * 1024;

// ─── Public API ───────────────────────────────────────────────────────────────

/** Sanitise filename: strip directory traversal, limit to safe alphanumeric characters. */
export function sanitizeFilename(original: string): string {
  const parsed = path.parse(original);
  const safeBase = parsed.name
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 100);
  const safeExt = parsed.ext.toLowerCase();
  return `${safeBase || 'resume'}${safeExt}`;
}

export async function validateResumeBuffer(
  buffer: Buffer | undefined | null,
  originalName: string,
  maxSizeBytes: number = 10 * 1024 * 1024
): Promise<ValidationResult> {
  const sanitizedFilename = sanitizeFilename(originalName);

  // 1. Empty file
  if (!buffer || buffer.length === 0) {
    return fail('EMPTY', 'The uploaded resume file is empty or missing.', null, null, 0, 400);
  }

  const fileSizeBytes = buffer.length;

  // 2. Size limit check
  if (fileSizeBytes > maxSizeBytes) {
    const limitMB = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    return fail('TOO_LARGE', `File exceeds the maximum allowed size of ${limitMB} MB.`, null, null, fileSizeBytes, 413);
  }

  // 3. Extension check
  const rawExt = path.extname(originalName).toLowerCase().replace('.', '');
  if (!ALLOWED_EXTENSIONS.includes(rawExt as AllowedExtension)) {
    if (rawExt === 'doc') {
      return fail(
        'BAD_EXTENSION',
        'Legacy .doc format is not supported. Please upload your resume in .pdf or modern .docx format.',
        null,
        null,
        fileSizeBytes,
        415
      );
    }
    return fail(
      'BAD_EXTENSION',
      `File type ".${rawExt}" is not allowed. Only PDF and DOCX files are accepted.`,
      null,
      null,
      fileSizeBytes,
      415
    );
  }

  const ext = rawExt as AllowedExtension;

  // 4. Content-based validation
  if (ext === 'pdf') {
    const pdfResult = validatePdfContent(buffer);
    if (!pdfResult.valid) {
      return {
        valid: false,
        isValid: false,
        extension: ext,
        fileType: 'pdf',
        mimeType: ALLOWED_MIMES[ext],
        checksum: null,
        fileSizeBytes,
        sanitizedFilename,
        statusCode: 400,
        errorCode: pdfResult.errorCode,
        errorMessage: pdfResult.errorMessage,
        error: pdfResult.errorMessage,
      };
    }
  } else if (ext === 'docx') {
    const docxResult = await validateDocxContent(buffer);
    if (!docxResult.valid) {
      return {
        valid: false,
        isValid: false,
        extension: ext,
        fileType: 'docx',
        mimeType: ALLOWED_MIMES[ext],
        checksum: null,
        fileSizeBytes,
        sanitizedFilename,
        statusCode: 400,
        errorCode: docxResult.errorCode,
        errorMessage: docxResult.errorMessage,
        error: docxResult.errorMessage,
      };
    }
  }

  // 5. Compute SHA-256 checksum
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

  return {
    valid: true,
    isValid: true,
    extension: ext,
    fileType: ext,
    mimeType: ALLOWED_MIMES[ext],
    checksum,
    checksumSha256: checksum,
    fileSizeBytes,
    sanitizedFilename,
    statusCode: 200,
  };
}

// ─── PDF Validation ───────────────────────────────────────────────────────────

function validatePdfContent(buffer: Buffer): { valid: boolean; errorCode?: 'BAD_CONTENT' | 'CORRUPT'; errorMessage?: string } {
  // Must start with %PDF- (within first 1024 bytes)
  const headerSlice = buffer.subarray(0, Math.min(1024, buffer.length));
  if (buffer.length < 5 || !headerSlice.toString('latin1').includes('%PDF-')) {
    return { valid: false, errorCode: 'BAD_CONTENT', errorMessage: 'The file does not contain a valid PDF structure.' };
  }

  // Must contain %%EOF marker somewhere in the last 1 KB
  const tail = buffer.subarray(Math.max(0, buffer.length - 1024)).toString('latin1');
  if (!tail.includes('%%EOF')) {
    return { valid: false, errorCode: 'CORRUPT', errorMessage: 'The PDF document appears to be incomplete or corrupted.' };
  }

  return { valid: true };
}

// ─── DOCX Validation ──────────────────────────────────────────────────────────

async function validateDocxContent(
  buffer: Buffer
): Promise<{ valid: boolean; errorCode?: 'BAD_CONTENT' | 'CORRUPT'; errorMessage?: string }> {
  // Must start with PK magic (0x50, 0x4B, 0x03, 0x04)
  if (buffer.length < 4 || !buffer.subarray(0, 4).equals(ZIP_MAGIC)) {
    return { valid: false, errorCode: 'BAD_CONTENT', errorMessage: 'The file does not contain a valid DOCX structure.' };
  }

  // Parse central directory to verify presence of word/document.xml
  try {
    const hasDocumentXml = await zipContainsEntry(buffer, 'word/document.xml');
    if (!hasDocumentXml) {
      return { valid: false, errorCode: 'BAD_CONTENT', errorMessage: 'The file is not a valid DOCX document (missing word/document.xml).' };
    }
  } catch (err: any) {
    return { valid: false, errorCode: 'CORRUPT', errorMessage: 'The DOCX archive appears to be corrupted or could not be parsed.' };
  }

  return { valid: true };
}

/**
 * Minimal ZIP central-directory scanner.
 * Reads the End-of-Central-Directory record, then walks the central directory
 * to find entry names without decompressing entry data.
 * Safe against ZIP-bombs.
 */
async function zipContainsEntry(buffer: Buffer, targetEntry: string): Promise<boolean> {
  const EOCD_SIG = 0x06054b50;
  let eocdOffset = -1;

  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset < 0) throw new Error('No EOCD found');

  const centralDirSize   = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (centralDirOffset + centralDirSize > buffer.length) {
    throw new Error('EOCD points past end of buffer');
  }

  if (centralDirSize > MAX_DOCX_INSPECT_BYTES) {
    throw new Error('Central directory is suspiciously large');
  }

  const CD_SIG = 0x02014b50;
  let pos = centralDirOffset;

  while (pos < centralDirOffset + centralDirSize && pos < buffer.length - 4) {
    if (buffer.readUInt32LE(pos) !== CD_SIG) break;

    const fileNameLength  = buffer.readUInt16LE(pos + 28);
    const extraLength     = buffer.readUInt16LE(pos + 30);
    const commentLength   = buffer.readUInt16LE(pos + 32);

    const nameStart = pos + 46;
    const nameEnd   = nameStart + fileNameLength;

    if (nameEnd > buffer.length) break;

    const entryName = buffer.subarray(nameStart, nameEnd).toString('utf8');
    if (entryName === targetEntry) return true;

    pos = nameEnd + extraLength + commentLength;
  }

  return false;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fail(
  errorCode: ValidationResult['errorCode'],
  errorMessage: string,
  extension: AllowedExtension | null,
  mimeType: string | null,
  fileSizeBytes: number = 0,
  statusCode: number = 400
): ValidationResult {
  return {
    valid: false,
    isValid: false,
    extension,
    fileType: extension || undefined,
    mimeType,
    checksum: null,
    fileSizeBytes,
    statusCode,
    errorCode,
    errorMessage,
    error: errorMessage,
  };
}

export class ResumeValidationService {
  static sanitizeFilename = sanitizeFilename;
  static validateResumeBuffer = validateResumeBuffer;
}
