/**
 * Image Validation and Sanitization Service
 * 
 * Validates in-memory image buffers for company logos:
 * - File size check against configured limit
 * - Content inspection / magic bytes detection for PNG, JPEG, and WebP
 * - Strict security sanitization and validation for SVG images (blocking XSS / scripts / dangerous elements)
 */
import path from 'path';

export interface ImageValidationResult {
  isValid: boolean;
  mimeType: string;
  extension: string;
  buffer: Buffer;
  error?: string;
}

// Magic bytes definitions
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const WEBP_RIFF = Buffer.from([0x52, 0x49, 0x46, 0x46]); // "RIFF"
const WEBP_MARKER = Buffer.from([0x57, 0x45, 0x42, 0x50]); // "WEBP"

/**
 * Sanitizes and verifies SVG content for safety.
 * Rejects SVGs containing script tags, event handlers, javascript: pseudo-protocols,
 * XML entity injection (XXE), and embedded objects.
 */
function validateAndSanitizeSvg(buffer: Buffer): { isValid: boolean; error?: string; sanitizedBuffer?: Buffer } {
  let content: string;
  try {
    content = buffer.toString('utf-8');
  } catch {
    return { isValid: false, error: 'SVG image could not be decoded as UTF-8.' };
  }

  // Must contain SVG tags
  if (!/<svg\b/i.test(content) || !/<\/svg>/i.test(content)) {
    return { isValid: false, error: 'File does not contain valid SVG elements.' };
  }

  // XSS & Code Execution Checks:
  // 1. Script tags
  if (/<script\b/i.test(content) || /<\/script>/i.test(content)) {
    return { isValid: false, error: 'SVG contains insecure script tags.' };
  }

  // 2. JavaScript: pseudo-protocol in attributes
  if (/javascript\s*:/i.test(content)) {
    return { isValid: false, error: 'SVG contains insecure javascript: URIs.' };
  }

  // 3. Inline event handlers (e.g., onload=, onerror=, onclick=)
  if (/\bon[a-z]+\s*=/i.test(content)) {
    return { isValid: false, error: 'SVG contains insecure event handlers.' };
  }

  // 4. Dangerous / executable tags
  if (/<(foreignObject|iframe|embed|object|applet|meta|link)\b/i.test(content)) {
    return { isValid: false, error: 'SVG contains disallowed HTML or embedded object tags.' };
  }

  // 5. XML External Entity (XXE) injection
  if (/<!ENTITY\b/i.test(content) || /SYSTEM\s+["']/i.test(content) || /PUBLIC\s+["']/i.test(content)) {
    return { isValid: false, error: 'SVG contains insecure XML entity declarations (XXE).' };
  }

  // 6. Data URIs with HTML or script content
  if (/data:\s*text\/(html|javascript)/i.test(content)) {
    return { isValid: false, error: 'SVG contains disallowed executable data URIs.' };
  }

  return {
    isValid: true,
    sanitizedBuffer: Buffer.from(content.trim(), 'utf-8'),
  };
}

/**
 * Validates an image buffer, its MIME type, and contents.
 */
export function validateImageBuffer(
  buffer: Buffer | undefined | null,
  originalFilename: string,
  maxSizeBytes: number = 5 * 1024 * 1024
): ImageValidationResult {
  if (!buffer || buffer.length === 0) {
    return {
      isValid: false,
      mimeType: '',
      extension: '',
      buffer: Buffer.alloc(0),
      error: 'The uploaded image file is empty or missing.',
    };
  }

  if (buffer.length > maxSizeBytes) {
    const limitMB = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    return {
      isValid: false,
      mimeType: '',
      extension: '',
      buffer,
      error: `Image file exceeds the maximum allowed size of ${limitMB} MB.`,
    };
  }

  // Inspect magic bytes
  // 1. PNG
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_MAGIC)) {
    return {
      isValid: true,
      mimeType: 'image/png',
      extension: '.png',
      buffer,
    };
  }

  // 2. JPEG
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(JPEG_MAGIC)) {
    const ext = path.extname(originalFilename).toLowerCase();
    return {
      isValid: true,
      mimeType: 'image/jpeg',
      extension: ext === '.jpeg' ? '.jpeg' : '.jpg',
      buffer,
    };
  }

  // 3. WebP
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).equals(WEBP_RIFF) &&
    buffer.subarray(8, 12).equals(WEBP_MARKER)
  ) {
    return {
      isValid: true,
      mimeType: 'image/webp',
      extension: '.webp',
      buffer,
    };
  }

  // 4. SVG
  const ext = path.extname(originalFilename).toLowerCase();
  const rawPrefix = buffer.subarray(0, 100).toString('utf-8').trimStart();
  if (ext === '.svg' || rawPrefix.startsWith('<?xml') || rawPrefix.startsWith('<svg')) {
    const svgValidation = validateAndSanitizeSvg(buffer);
    if (!svgValidation.isValid) {
      return {
        isValid: false,
        mimeType: '',
        extension: '',
        buffer,
        error: svgValidation.error || 'Invalid or insecure SVG file.',
      };
    }

    return {
      isValid: true,
      mimeType: 'image/svg+xml',
      extension: '.svg',
      buffer: svgValidation.sanitizedBuffer || buffer,
    };
  }

  return {
    isValid: false,
    mimeType: '',
    extension: '',
    buffer,
    error: 'Unsupported image format. Allowed formats are PNG, JPEG, WebP, and sanitized SVG.',
  };
}
