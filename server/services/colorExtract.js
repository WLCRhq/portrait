import { inflateSync } from 'zlib';

/**
 * Extract the background color from a PNG buffer by reading the top-left pixel.
 * Returns a hex string like "#e8e8e8" or null on failure.
 */
export function extractBgColorFromPng(pngBuffer) {
  try {
    // Verify PNG signature
    if (pngBuffer[0] !== 0x89 || pngBuffer[1] !== 0x50) return null;

    // Read IHDR chunk (starts at byte 8)
    const colorType = pngBuffer[25];

    // Collect all IDAT compressed data
    const idatChunks = [];
    let offset = 8;
    while (offset < pngBuffer.length - 4) {
      const chunkLen = pngBuffer.readUInt32BE(offset);
      const chunkType = pngBuffer.subarray(offset + 4, offset + 8).toString('ascii');

      if (chunkType === 'IDAT') {
        idatChunks.push(pngBuffer.subarray(offset + 8, offset + 8 + chunkLen));
      }
      if (chunkType === 'IEND') break;

      offset += 12 + chunkLen;
    }

    if (idatChunks.length === 0) return null;

    // Decompress pixel data
    const compressed = Buffer.concat(idatChunks);
    const raw = inflateSync(compressed);

    // First byte of first row is the filter type, then pixel data follows
    // Color type 2 = RGB (3 bytes/pixel), type 6 = RGBA (4 bytes/pixel)
    if (colorType === 2 || colorType === 6) {
      const r = raw[1]; // skip filter byte
      const g = raw[2];
      const b = raw[3];
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    return null;
  } catch (err) {
    console.warn('[ColorExtract] Failed:', err.message);
    return null;
  }
}
