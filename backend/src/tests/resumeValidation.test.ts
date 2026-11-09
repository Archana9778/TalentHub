/**
 * TalentHub Resume Validation Tests
 * Run with: npx tsx src/tests/resumeValidation.test.ts
 *
 * Tests that run without any external service (MySQL / Azurite):
 *   - File validation logic (content inspection, checksums, filename sanitisation)
 *
 * Tests marked [INTEGRATION] require Azurite + MySQL and are skipped when
 * those services are unavailable.
 */
import crypto from 'crypto';
import { validateResumeBuffer, sanitizeFilename } from '../services/resumeValidationService';

// ─── Minimal synthetic file buffers ──────────────────────────────────────────

/** Valid minimal PDF — has %PDF- header and %%EOF footer. */
const VALID_PDF = Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n%%EOF\n', 'latin1');

/** Builds a minimal but structurally valid DOCX (ZIP containing word/document.xml). */
function buildMinimalDocx(): Buffer {
  const entryName = 'word/document.xml';
  const entryContent = Buffer.from('<root/>');
  const fnBuf = Buffer.from(entryName);

  // ── CRC-32 (required by ZIP spec) ────────────────────────────────────────
  const crc = computeCrc32(entryContent);

  // ── Local File Header (30 bytes fixed + filename + content) ──────────────
  const lfh = Buffer.alloc(30);
  lfh.writeUInt32LE(0x04034b50, 0);      // local file header signature
  lfh.writeUInt16LE(20, 4);              // version needed to extract
  lfh.writeUInt16LE(0, 6);              // general purpose bit flag
  lfh.writeUInt16LE(0, 8);              // compression method: stored
  lfh.writeUInt16LE(0, 10);             // last mod file time
  lfh.writeUInt16LE(0, 12);             // last mod file date
  lfh.writeUInt32LE(crc, 14);           // crc-32
  lfh.writeUInt32LE(entryContent.length, 18); // compressed size
  lfh.writeUInt32LE(entryContent.length, 22); // uncompressed size
  lfh.writeUInt16LE(fnBuf.length, 26);  // file name length
  lfh.writeUInt16LE(0, 28);             // extra field length

  const lfhBlock = Buffer.concat([lfh, fnBuf, entryContent]);
  const lfhOffset = 0;

  // ── Central Directory Header (46 bytes fixed + filename) ─────────────────
  const cdh = Buffer.alloc(46);
  cdh.writeUInt32LE(0x02014b50, 0);     // central directory signature
  cdh.writeUInt16LE(20, 4);             // version made by
  cdh.writeUInt16LE(20, 6);             // version needed
  cdh.writeUInt16LE(0, 8);              // general purpose bit flag
  cdh.writeUInt16LE(0, 10);             // compression method
  cdh.writeUInt16LE(0, 12);             // last mod file time
  cdh.writeUInt16LE(0, 14);             // last mod file date
  cdh.writeUInt32LE(crc, 16);           // crc-32
  cdh.writeUInt32LE(entryContent.length, 20); // compressed size
  cdh.writeUInt32LE(entryContent.length, 24); // uncompressed size
  cdh.writeUInt16LE(fnBuf.length, 28);  // file name length
  cdh.writeUInt16LE(0, 30);             // extra field length
  cdh.writeUInt16LE(0, 32);             // file comment length
  cdh.writeUInt16LE(0, 34);             // disk number start
  cdh.writeUInt16LE(0, 36);             // internal file attributes
  cdh.writeUInt32LE(0, 38);             // external file attributes
  cdh.writeUInt32LE(lfhOffset, 42);     // relative offset of local header

  const cdhBlock = Buffer.concat([cdh, fnBuf]);

  // ── End of Central Directory (22 bytes) ──────────────────────────────────
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);    // EOCD signature
  eocd.writeUInt16LE(0, 4);             // disk number
  eocd.writeUInt16LE(0, 6);             // disk with central dir
  eocd.writeUInt16LE(1, 8);             // entries on this disk
  eocd.writeUInt16LE(1, 10);            // total entries
  eocd.writeUInt32LE(cdhBlock.length, 12); // central dir size
  eocd.writeUInt32LE(lfhBlock.length, 16); // central dir offset
  eocd.writeUInt16LE(0, 20);            // comment length

  return Buffer.concat([lfhBlock, cdhBlock, eocd]);
}

/** Minimal CRC-32 needed to build a valid ZIP structure. */
function computeCrc32(buf: Buffer): number {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const VALID_DOCX = buildMinimalDocx();
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// ─── Lightweight test runner ──────────────────────────────────────────────────

type TestResult = { name: string; passed: boolean; error?: string };
const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  \u2705 PASS  ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
    console.log(`  \u274c FAIL  ${name}: ${err.message}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// ─── Main test suite ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n\ud83d\udccb TalentHub Resume Validation Tests');
  console.log('=====================================\n');

  // ── A. Format and content validation ───────────────────────────────────────

  await test('Valid PDF accepted', async () => {
    const r = await validateResumeBuffer(VALID_PDF, 'resume.pdf', MAX_SIZE_BYTES);
    assert(r.valid, `expected valid but got: ${r.errorMessage}`);
    assert(r.extension === 'pdf', `expected extension=pdf, got: ${r.extension}`);
    assert(r.checksum !== null && r.checksum!.length === 64, 'expected 64-char SHA-256 hex checksum');
  });

  await test('Valid DOCX accepted', async () => {
    const r = await validateResumeBuffer(VALID_DOCX, 'resume.docx', MAX_SIZE_BYTES);
    assert(r.valid, `expected valid but got: ${r.errorMessage}`);
    assert(r.extension === 'docx', `expected extension=docx, got: ${r.extension}`);
    assert(r.checksum !== null, 'expected checksum');
  });

  await test('Empty file rejected (EMPTY)', async () => {
    const r = await validateResumeBuffer(Buffer.alloc(0), 'resume.pdf', MAX_SIZE_BYTES);
    assert(!r.valid, 'expected invalid');
    assert(r.errorCode === 'EMPTY', `expected EMPTY, got: ${r.errorCode}`);
  });

  await test('PNG file rejected (BAD_EXTENSION)', async () => {
    const r = await validateResumeBuffer(VALID_PDF, 'photo.png', MAX_SIZE_BYTES);
    assert(!r.valid, 'expected invalid');
    assert(r.errorCode === 'BAD_EXTENSION', `expected BAD_EXTENSION, got: ${r.errorCode}`);
  });

  await test('JPG file rejected (BAD_EXTENSION)', async () => {
    const r = await validateResumeBuffer(VALID_PDF, 'photo.jpg', MAX_SIZE_BYTES);
    assert(!r.valid, 'expected invalid');
    assert(r.errorCode === 'BAD_EXTENSION', `expected BAD_EXTENSION, got: ${r.errorCode}`);
  });

  await test('EXE file rejected (BAD_EXTENSION)', async () => {
    const r = await validateResumeBuffer(Buffer.from('MZ\x90\x00'), 'virus.exe', MAX_SIZE_BYTES);
    assert(!r.valid, 'expected invalid');
    assert(r.errorCode === 'BAD_EXTENSION', `expected BAD_EXTENSION, got: ${r.errorCode}`);
  });

  await test('ZIP renamed .docx rejected (missing word/document.xml)', async () => {
    // A syntactically valid empty ZIP archive — no entries inside.
    const emptyZip = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x05, 0x06]), // EOCD signature
      Buffer.alloc(18, 0),                    // 18 zero bytes (no entries, no central dir)
    ]);
    const r = await validateResumeBuffer(emptyZip, 'fake.docx', MAX_SIZE_BYTES);
    assert(!r.valid, `expected invalid, got valid=${r.valid}`);
  });

  await test('Random bytes renamed .pdf rejected (BAD_CONTENT)', async () => {
    const r = await validateResumeBuffer(crypto.randomBytes(512), 'resume.pdf', MAX_SIZE_BYTES);
    assert(!r.valid, 'expected invalid');
    assert(
      r.errorCode === 'BAD_CONTENT' || r.errorCode === 'CORRUPT',
      `expected BAD_CONTENT or CORRUPT, got: ${r.errorCode}`
    );
  });

  await test('Oversized file rejected (TOO_LARGE)', async () => {
    const bigBuffer = Buffer.alloc(6 * 1024 * 1024, 0x41); // 6 MB, all 'A'
    const r = await validateResumeBuffer(bigBuffer, 'resume.pdf', MAX_SIZE_BYTES);
    assert(!r.valid, 'expected invalid');
    assert(r.errorCode === 'TOO_LARGE', `expected TOO_LARGE, got: ${r.errorCode}`);
  });

  await test('PDF missing %%EOF rejected (CORRUPT)', async () => {
    const truncated = Buffer.from('%PDF-1.4\nsome content with no eof marker at all');
    const r = await validateResumeBuffer(truncated, 'resume.pdf', MAX_SIZE_BYTES);
    assert(!r.valid, 'expected invalid');
    assert(r.errorCode === 'CORRUPT', `expected CORRUPT, got: ${r.errorCode}`);
  });

  // ── B. Checksum integrity ──────────────────────────────────────────────────

  await test('SHA-256 checksum is deterministic and correct', async () => {
    const r1 = await validateResumeBuffer(VALID_PDF, 'resume.pdf', MAX_SIZE_BYTES);
    const r2 = await validateResumeBuffer(VALID_PDF, 'resume.pdf', MAX_SIZE_BYTES);
    assert(r1.checksum === r2.checksum, 'checksums differ between identical runs');
    const expected = crypto.createHash('sha256').update(VALID_PDF).digest('hex');
    assert(r1.checksum === expected, `checksum mismatch: got ${r1.checksum}, expected ${expected}`);
  });

  // ── C. Filename sanitisation ───────────────────────────────────────────────

  await test('sanitizeFilename strips path traversal sequences', () => {
    const result = sanitizeFilename('../../../etc/passwd');
    assert(!result.includes('..'), `".." found in sanitised name: ${result}`);
    assert(!result.includes('/'), `"/" found in sanitised name: ${result}`);
    assert(!result.includes('\\'), `"\\" found in sanitised name: ${result}`);
  });

  await test('sanitizeFilename strips special/non-ASCII characters', () => {
    const result = sanitizeFilename('My Résumé 2026 (Draft).pdf');
    assert(
      /^[a-zA-Z0-9._-]+$/.test(result),
      `sanitised filename contains unexpected characters: ${result}`
    );
  });

  await test('sanitizeFilename preserves safe alphanumeric names', () => {
    const result = sanitizeFilename('John_Doe_Resume-2026.pdf');
    assert(result === 'John_Doe_Resume-2026.pdf', `expected unchanged, got: ${result}`);
  });

  // ── Summary ────────────────────────────────────────────────────────────────

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n=====================================');
  console.log(`Results: ${passed} passed, ${failed} failed out of ${results.length} tests`);

  if (failed === 0) {
    console.log('\ud83c\udf89 All validation tests passed!');
    process.exit(0);
  } else {
    console.log('\u26a0\ufe0f  Some tests failed. See above for details.');
    process.exit(1);
  }
}

// Run — catch any top-level crash so we always exit with a clear message.
main().catch((err) => {
  console.error('\n[FATAL] Test runner crashed:', err);
  process.exit(2);
});
