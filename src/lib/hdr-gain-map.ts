// Detects whether a photo carries an HDR gain map. Diagnostic use only.
//
// Phones store HDR photos as a normal SDR image plus a second, smaller
// "gain map" image that tells an HDR display how much brighter each area
// may go. Only the display uses it: a 2D canvas, a JPEG re-encode or a print
// RIP all read the SDR base and drop the map. On an HDR screen the file
// therefore looks brighter than anything derived from it, which reads as
// "the processed photo came out darker" when the pipeline changed nothing.
//
// Two conventions cover practically every phone:
//  - Apple HEIC/HEIF: an auxiliary image typed
//    "urn:com:apple:photo:2020:aux:hdrgainmap" in the meta box.
//  - Ultra HDR JPEG (Android, Adobe): an XMP packet in the "hdrgm" namespace
//    (http://ns.adobe.com/hdr-gain-map/1.0/) in an APP1 segment.
// Both markers sit in the file header, so scanning the first few megabytes
// is enough and keeps the check cheap for 20 MB originals.

const SCAN_LIMIT = 4 * 1024 * 1024;

const MARKERS = ["aux:hdrgainmap", "hdr-gain-map/", "hdrgm:Version"].map((s) =>
  Uint8Array.from(s, (c) => c.charCodeAt(0)),
);

function contains(haystack: Uint8Array, needle: Uint8Array): boolean {
  const first = needle[0];
  const last = haystack.length - needle.length;
  outer: for (let i = 0; i <= last; i++) {
    if (haystack[i] !== first) continue;
    for (let j = 1; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

/** True when the file header advertises an HDR gain map (Apple or Ultra HDR). */
export function hasHdrGainMap(bytes: Uint8Array): boolean {
  const head = bytes.length > SCAN_LIMIT ? bytes.subarray(0, SCAN_LIMIT) : bytes;
  return MARKERS.some((m) => contains(head, m));
}
