// Embeds an sRGB ICC profile into a JPEG produced by canvas.toBlob().
//
// Browsers write untagged JPEGs. Most print RIPs assume sRGB for an untagged
// file, but not all: some fall back to the printer's working space or skip
// color management entirely, which flattens and darkens the image. Tagging
// the file removes the guess. The profile is the standard "sRGB IEC61966-2.1"
// (v2, 3144 bytes) that cameras and image editors have embedded for decades,
// so every RIP recognizes it.

const SRGB_ICC_BASE64 =
  "AAAMSExpbm8CEAAAbW50clJHQiBYWVogB84AAgAJAAYAMQAAYWNzcE1TRlQAAAAASUVDIHNSR0IAAAAAAAAAAAAAAAAAAPbW" +
  "AAEAAAAA0y1IUCAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARY3BydAAAAVAAAAAz" +
  "ZGVzYwAAAYQAAABsd3RwdAAAAfAAAAAUYmtwdAAAAgQAAAAUclhZWgAAAhgAAAAUZ1hZWgAAAiwAAAAUYlhZWgAAAkAAAAAU" +
  "ZG1uZAAAAlQAAABwZG1kZAAAAsQAAACIdnVlZAAAA0wAAACGdmlldwAAA9QAAAAkbHVtaQAAA/gAAAAUbWVhcwAABAwAAAAk" +
  "dGVjaAAABDAAAAAMclRSQwAABDwAAAgMZ1RSQwAABDwAAAgMYlRSQwAABDwAAAgMdGV4dAAAAABDb3B5cmlnaHQgKGMpIDE5" +
  "OTggSGV3bGV0dC1QYWNrYXJkIENvbXBhbnkAAGRlc2MAAAAAAAAAEnNSR0IgSUVDNjE5NjYtMi4xAAAAAAAAAAAAAAASc1JH" +
  "QiBJRUM2MTk2Ni0yLjEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFhZWiAAAAAA" +
  "AADzUQABAAAAARbMWFlaIAAAAAAAAAAAAAAAAAAAAABYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABja" +
  "WFlaIAAAAAAAACSgAAAPhAAAts9kZXNjAAAAAAAAABZJRUMgaHR0cDovL3d3dy5pZWMuY2gAAAAAAAAAAAAAABZJRUMgaHR0" +
  "cDovL3d3dy5pZWMuY2gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZGVzYwAAAAAAAAAu" +
  "SUVDIDYxOTY2LTIuMSBEZWZhdWx0IFJHQiBjb2xvdXIgc3BhY2UgLSBzUkdCAAAAAAAAAAAAAAAuSUVDIDYxOTY2LTIuMSBE" +
  "ZWZhdWx0IFJHQiBjb2xvdXIgc3BhY2UgLSBzUkdCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGRlc2MAAAAAAAAALFJlZmVyZW5j" +
  "ZSBWaWV3aW5nIENvbmRpdGlvbiBpbiBJRUM2MTk2Ni0yLjEAAAAAAAAAAAAAACxSZWZlcmVuY2UgVmlld2luZyBDb25kaXRp" +
  "b24gaW4gSUVDNjE5NjYtMi4xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB2aWV3AAAAAAATpP4AFF8uABDPFAAD7cwABBML" +
  "AANcngAAAAFYWVogAAAAAABMCVYAUAAAAFcf521lYXMAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAKPAAAAAnNpZyAAAAAA" +
  "Q1JUIGN1cnYAAAAAAAAEAAAAAAUACgAPABQAGQAeACMAKAAtADIANwA7AEAARQBKAE8AVABZAF4AYwBoAG0AcgB3AHwAgQCG" +
  "AIsAkACVAJoAnwCkAKkArgCyALcAvADBAMYAywDQANUA2wDgAOUA6wDwAPYA+wEBAQcBDQETARkBHwElASsBMgE4AT4BRQFM" +
  "AVIBWQFgAWcBbgF1AXwBgwGLAZIBmgGhAakBsQG5AcEByQHRAdkB4QHpAfIB+gIDAgwCFAIdAiYCLwI4AkECSwJUAl0CZwJx" +
  "AnoChAKOApgCogKsArYCwQLLAtUC4ALrAvUDAAMLAxYDIQMtAzgDQwNPA1oDZgNyA34DigOWA6IDrgO6A8cD0wPgA+wD+QQG" +
  "BBMEIAQtBDsESARVBGMEcQR+BIwEmgSoBLYExATTBOEE8AT+BQ0FHAUrBToFSQVYBWcFdwWGBZYFpgW1BcUF1QXlBfYGBgYW" +
  "BicGNwZIBlkGagZ7BowGnQavBsAG0QbjBvUHBwcZBysHPQdPB2EHdAeGB5kHrAe/B9IH5Qf4CAsIHwgyCEYIWghuCIIIlgiq" +
  "CL4I0gjnCPsJEAklCToJTwlkCXkJjwmkCboJzwnlCfsKEQonCj0KVApqCoEKmAquCsUK3ArzCwsLIgs5C1ELaQuAC5gLsAvI" +
  "C+EL+QwSDCoMQwxcDHUMjgynDMAM2QzzDQ0NJg1ADVoNdA2ODakNww3eDfgOEw4uDkkOZA5/DpsOtg7SDu4PCQ8lD0EPXg96" +
  "D5YPsw/PD+wQCRAmEEMQYRB+EJsQuRDXEPURExExEU8RbRGMEaoRyRHoEgcSJhJFEmQShBKjEsMS4xMDEyMTQxNjE4MTpBPF" +
  "E+UUBhQnFEkUahSLFK0UzhTwFRIVNBVWFXgVmxW9FeAWAxYmFkkWbBaPFrIW1hb6Fx0XQRdlF4kXrhfSF/cYGxhAGGUYihiv" +
  "GNUY+hkgGUUZaxmRGbcZ3RoEGioaURp3Gp4axRrsGxQbOxtjG4obshvaHAIcKhxSHHscoxzMHPUdHh1HHXAdmR3DHeweFh5A" +
  "HmoelB6+HukfEx8+H2kflB+/H+ogFSBBIGwgmCDEIPAhHCFIIXUhoSHOIfsiJyJVIoIiryLdIwojOCNmI5QjwiPwJB8kTSR8" +
  "JKsk2iUJJTglaCWXJccl9yYnJlcmhya3JugnGCdJJ3onqyfcKA0oPyhxKKIo1CkGKTgpaymdKdAqAio1KmgqmyrPKwIrNitp" +
  "K50r0SwFLDksbiyiLNctDC1BLXYtqy3hLhYuTC6CLrcu7i8kL1ovkS/HL/4wNTBsMKQw2zESMUoxgjG6MfIyKjJjMpsy1DMN" +
  "M0YzfzO4M/E0KzRlNJ402DUTNU01hzXCNf02NzZyNq426TckN2A3nDfXOBQ4UDiMOMg5BTlCOX85vDn5OjY6dDqyOu87LTtr" +
  "O6o76DwnPGU8pDzjPSI9YT2hPeA+ID5gPqA+4D8hP2E/oj/iQCNAZECmQOdBKUFqQaxB7kIwQnJCtUL3QzpDfUPARANER0SK" +
  "RM5FEkVVRZpF3kYiRmdGq0bwRzVHe0fASAVIS0iRSNdJHUljSalJ8Eo3Sn1KxEsMS1NLmkviTCpMcky6TQJNSk2TTdxOJU5u" +
  "TrdPAE9JT5NP3VAnUHFQu1EGUVBRm1HmUjFSfFLHUxNTX1OqU/ZUQlSPVNtVKFV1VcJWD1ZcVqlW91dEV5JX4FgvWH1Yy1ka" +
  "WWlZuFoHWlZaplr1W0VblVvlXDVchlzWXSddeF3JXhpebF69Xw9fYV+zYAVgV2CqYPxhT2GiYfViSWKcYvBjQ2OXY+tkQGSU" +
  "ZOllPWWSZedmPWaSZuhnPWeTZ+loP2iWaOxpQ2maafFqSGqfavdrT2una/9sV2yvbQhtYG25bhJua27Ebx5veG/RcCtwhnDg" +
  "cTpxlXHwcktypnMBc11zuHQUdHB0zHUodYV14XY+dpt2+HdWd7N4EXhueMx5KnmJeed6RnqlewR7Y3vCfCF8gXzhfUF9oX4B" +
  "fmJ+wn8jf4R/5YBHgKiBCoFrgc2CMIKSgvSDV4O6hB2EgITjhUeFq4YOhnKG14c7h5+IBIhpiM6JM4mZif6KZIrKizCLlov8" +
  "jGOMyo0xjZiN/45mjs6PNo+ekAaQbpDWkT+RqJIRknqS45NNk7aUIJSKlPSVX5XJljSWn5cKl3WX4JhMmLiZJJmQmfyaaJrV" +
  "m0Kbr5wcnImc951kndKeQJ6unx2fi5/6oGmg2KFHobaiJqKWowajdqPmpFakx6U4pammGqaLpv2nbqfgqFKoxKk3qamqHKqP" +
  "qwKrdavprFys0K1ErbiuLa6hrxavi7AAsHWw6rFgsdayS7LCszizrrQltJy1E7WKtgG2ebbwt2i34LhZuNG5SrnCuju6tbsu" +
  "u6e8IbybvRW9j74KvoS+/796v/XAcMDswWfB48JfwtvDWMPUxFHEzsVLxcjGRsbDx0HHv8g9yLzJOsm5yjjKt8s2y7bMNcy1" +
  "zTXNtc42zrbPN8+40DnQutE80b7SP9LB00TTxtRJ1MvVTtXR1lXW2Ndc1+DYZNjo2WzZ8dp22vvbgNwF3IrdEN2W3hzeot8p" +
  "36/gNuC94UThzOJT4tvjY+Pr5HPk/OWE5g3mlucf56noMui86Ubp0Opb6uXrcOv77IbtEe2c7ijutO9A78zwWPDl8XLx//KM" +
  "8xnzp/Q09ML1UPXe9m32+/eK+Bn4qPk4+cf6V/rn+3f8B/yY/Sn9uv5L/tz/bf//";

const APP0 = 0xe0; // JFIF
const APP1 = 0xe1; // Exif / XMP
const APP2 = 0xe2; // ICC profile lives here
const ICC_TAG = "ICC_PROFILE\0";

let profileCache: Uint8Array | null = null;

function srgbProfileBytes(): Uint8Array {
  if (!profileCache) {
    const bin = atob(SRGB_ICC_BASE64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    profileCache = out;
  }
  return profileCache;
}

function segmentLength(bytes: Uint8Array, pos: number): number {
  return (bytes[pos + 2] << 8) | bytes[pos + 3];
}

function isIccSegment(bytes: Uint8Array, pos: number): boolean {
  if (bytes[pos + 1] !== APP2) return false;
  for (let i = 0; i < ICC_TAG.length; i++) {
    if (bytes[pos + 4 + i] !== ICC_TAG.charCodeAt(i)) return false;
  }
  return true;
}

/**
 * Returns a copy of `jpeg` with an sRGB profile in an APP2 segment. The
 * segment goes right after any JFIF/Exif headers, which the JPEG spec wants
 * first. Non-JPEG input and files that already carry a profile are returned
 * untouched.
 */
export async function embedSrgbProfile(jpeg: Blob): Promise<Blob> {
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return jpeg;

  let pos = 2;
  while (pos + 4 <= bytes.length && bytes[pos] === 0xff) {
    const marker = bytes[pos + 1];
    if (marker === APP0 || marker === APP1) {
      pos += 2 + segmentLength(bytes, pos);
      continue;
    }
    if (isIccSegment(bytes, pos)) return jpeg;
    break;
  }

  const profile = srgbProfileBytes();
  // Length field counts itself, the tag, the chunk index/count pair and the
  // profile, but not the marker. sRGB fits in a single chunk with room to
  // spare under the 65535 limit.
  const length = 2 + ICC_TAG.length + 2 + profile.length;
  const segment = new Uint8Array(2 + length);
  segment[0] = 0xff;
  segment[1] = APP2;
  segment[2] = (length >> 8) & 0xff;
  segment[3] = length & 0xff;
  for (let i = 0; i < ICC_TAG.length; i++) segment[4 + i] = ICC_TAG.charCodeAt(i);
  segment[4 + ICC_TAG.length] = 1; // chunk 1
  segment[5 + ICC_TAG.length] = 1; // of 1
  segment.set(profile, 6 + ICC_TAG.length);

  const out = new Uint8Array(bytes.length + segment.length);
  out.set(bytes.subarray(0, pos), 0);
  out.set(segment, pos);
  out.set(bytes.subarray(pos), pos + segment.length);
  return new Blob([out], { type: "image/jpeg" });
}

/**
 * Reads the human-readable name of the ICC profile embedded in a JPEG
 * ("sRGB IEC61966-2.1", "Display P3", ...). Returns null when the file is not
 * a JPEG or carries no profile. Only the `desc` tag is parsed; multi-chunk
 * profiles are reassembled in chunk order. Diagnostic use only.
 */
export function readJpegIccDescription(bytes: Uint8Array): string | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  const chunks: { index: number; data: Uint8Array }[] = [];
  let pos = 2;
  while (pos + 4 <= bytes.length && bytes[pos] === 0xff) {
    const marker = bytes[pos + 1];
    if (marker === 0xda) break; // start of scan: no more headers
    const len = segmentLength(bytes, pos);
    if (isIccSegment(bytes, pos)) {
      const head = pos + 4 + ICC_TAG.length;
      chunks.push({ index: bytes[head], data: bytes.subarray(head + 2, pos + 2 + len) });
    }
    pos += 2 + len;
  }
  if (chunks.length === 0) return null;

  chunks.sort((a, b) => a.index - b.index);
  const total = chunks.reduce((n, c) => n + c.data.length, 0);
  const profile = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    profile.set(c.data, off);
    off += c.data.length;
  }
  return readIccDescription(profile);
}

function u32(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

function readIccDescription(profile: Uint8Array): string | null {
  if (profile.length < 132) return null;
  const tagCount = u32(profile, 128);
  for (let i = 0; i < tagCount; i++) {
    const e = 132 + i * 12;
    if (e + 12 > profile.length) break;
    const sig = String.fromCharCode(profile[e], profile[e + 1], profile[e + 2], profile[e + 3]);
    if (sig !== "desc") continue;
    const off = u32(profile, e + 4);
    const size = u32(profile, e + 8);
    if (off + size > profile.length) return null;
    const type = String.fromCharCode(profile[off], profile[off + 1], profile[off + 2], profile[off + 3]);
    if (type === "desc") {
      // v2: textDescriptionType, ASCII length at +8, string at +12
      const n = u32(profile, off + 8);
      let s = "";
      for (let k = 0; k < n; k++) {
        const c = profile[off + 12 + k];
        if (c === 0) break;
        s += String.fromCharCode(c);
      }
      return s || null;
    }
    if (type === "mluc") {
      // v4: multiLocalizedUnicodeType, first record: length at +20, offset at +24 (UTF-16BE)
      const len = u32(profile, off + 20);
      const rec = u32(profile, off + 24);
      let s = "";
      for (let k = 0; k + 1 < len; k += 2) {
        s += String.fromCharCode((profile[off + rec + k] << 8) | profile[off + rec + k + 1]);
      }
      return s || null;
    }
    return null;
  }
  return null;
}
