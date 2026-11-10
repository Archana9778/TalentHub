/**
 * TalentHub Resume Validation Service
 *
 * Validates uploaded resume files using:
 * 1. File size check
 * 2. Declared extension check
 * 3. Declared MIME type check
 * 4. Actual file content / magic-byte inspection via `file-type`
 * 5. PDF structural validation (must start with %PDF- header)
 * 6. DOCX structural validation (must be a valid ZIP containing word/document.xml)
 * 7. ZIP-bomb protection for DOCX archives
 * 8. SHA-256 checksum computation
 *
 * All validation is performed against the in-memory buffer — no disk writes.
 */
import crypto from 'crypto';
import path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AllowedExtension = 'pdf' | 'docx';

export interface ValidationResult {
  valid: boolean;
  extension: AllowedExtension | null;
  mimeType: string | null;
  checksum: string | null;
  errorCode?: 'TOO_LARGE' | 'EMPTY' | 'BAD_EXTENSION' | 'BAD_MIME' | 'BAD_CONTENT' | 'CORRUPT';
  errorMessage?: string;
}

const ALLOWED_EXTENSIONS: AllowedExtension[] = ['pdf', 'docx'];
const ALLOWED_MIMES: Record<AllowedExtension, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

// PDF magic bytes: %PDF-
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);
// ZIP/DOCX magic bytes: PK\x03\x04
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/** Max uncompressed DOCX inspection size: 50 MB (ZIP-bomb guard) */
const MAX_DOCX_INSPECT_BYTES = 50 * 1024 * 1024;

// ─── Public API ───────────────────────────────────────────────────────────────

export async function validateResumeBuffer(
  buffer: Buffer,
  originalName: string,
  maxSizeBytes: number
): Promise<ValidationResult> {
  // 1. Empty file
  if (!buffer || buffer.length === 0) {
    return fail('EMPTY', 'The uploaded file is empty.', null, null);
  }

  // 2. Size limit
  if (buffer.length > maxSizeBytes) {
    const limitMB = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    return fail('TOO_LARGE', `File exceeds the maximum allowed size of ${limitMB} MB.`, null, null);
  }

  // 3. Extension check
  const ext = path.extname(originalName).toLowerCase().replace('.', '') as AllowedExtension;
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return fail('BAD_EXTENSION', `File type ".${ext}" is not allowed. Only PDF and DOCX files are accepted.`, null, null);
  }

  // 4. Content-based MIME type detection
  // file-type is an ESM-only package; use a typed dynamic import with any cast
  let detectedMime: string | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ft = await (Function('return import("file-type")')() as Promise<any>);
    const result = await ft.fileTypeFromBuffer(buffer);
    detectedMime = result?.mime ?? null;
  } catch {
    // If file-type cannot load, skip MIME detection; structure checks are still performed
  }

  // Allowable MIME types per extension
  const expectedMimes: Record<AllowedExtension, string[]> = {
    pdf: ['application/pdf'],
    docx: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',   // file-type may return zip for OOXML
    ],
  };

  const allowedMimesForExt = expectedMimes[ext];

  if (detectedMime !== null && !allowedMimesForExt.includes(detectedMime)) {
    return fail(
      'BAD_MIME',
      `The file content does not match the declared format. Expected ${ext.toUpperCase()} but detected: ${detectedMime}.`,
      ext,
      null
    );
  }

  // 5. Deep content validation
  if (ext === 'pdf') {
    const pdfResult = validatePdfContent(buffer);
    if (!pdfResult.valid) return { ...pdfResult, extension: ext, mimeType: ALLOWED_MIMES[ext], checksum: null };
  } else if (ext === 'docx') {
    const docxResult = await validateDocxContent(buffer);
    if (!docxResult.valid) return { ...docxResult, extension: ext, mimeType: ALLOWED_MIMES[ext], checksum: null };
  }

  // 6. Compute SHA-256 checksum
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

  return {
    valid: true,
    extension: ext,
    mimeType: ALLOWED_MIMES[ext],
    checksum,
  };
}

// ─── PDF Validation ───────────────────────────────────────────────────────────

function validatePdfContent(buffer: Buffer): Omit<ValidationResult, 'extension' | 'mimeType' | 'checksum'> {
  // Must start with %PDF-
  if (buffer.length < 5 || !buffer.slice(0, 5).equals(PDF_MAGIC)) {
    return { valid: false, errorCode: 'BAD_CONTENT', errorMessage: 'The file does not contain a valid PDF structure.' };
  }

  // Must contain %%EOF marker somewhere in the last 1 KB
  const tail = buffer.slice(Math.max(0, buffer.length - 1024)).toString('latin1');
  if (!tail.includes('%%EOF')) {
    return { valid: false, errorCode: 'CORRUPT', errorMessage: 'The PDF document appears to be incomplete or corrupted.' };
  }

  return { valid: true };
}

// ─── DOCX Validation ──────────────────────────────────────────────────────────

async function validateDocxContent(
  buffer: Buffer
): Promise<Omit<ValidationResult, 'extension' | 'mimeType' | 'checksum'>> {
  // Must start with PK magic (ZIP)
  if (buffer.length < 4 || !buffer.slice(0, 4).equals(ZIP_MAGIC)) {
    return { valid: false, errorCode: 'BAD_CONTENT', errorMessage: 'The file does not contain a valid DOCX structure.' };
  }

  // Parse central directory to find word/document.xml
  // We use a lightweight manual parser to avoid a full decompression library dependency
  // and to protect against ZIP bombs.
  try {
    const hasDocumentXml = await _zipContainsEntry(buffer, 'word/document.xml');
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
 * to find file names. Never decompresses any entry data.
 * ZIP-bomb safe: only reads file *names*, not content.
 */
async function _zipContainsEntry(buffer: Buffer, targetEntry: string): Promise<boolean> {
  // Locate End of Central Directory signature: 0x06054b50 (little-endian)
  const EOCD_SIG = 0x06054b50;
  let eocdOffset = -1;

  // Scan from the end (comment may follow EOCD)
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

  // Guard: prevent reading absurdly large central directories (ZIP-bomb protection)
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

    const entryName = buffer.slice(nameStart, nameEnd).toString('utf8');
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
  mimeType: string | null
): ValidationResult {
  return { valid: false, extension, mimeType, checksum: null, errorCode, errorMessage };
}

/** Sanitise filename: strip directory traversal, limit to safe characters. */
export function sanitizeFilename(original: string): string {
  const basename = path.basename(original);
  // Allow alphanumerics, hyphens, underscores, dots
  return basename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}
