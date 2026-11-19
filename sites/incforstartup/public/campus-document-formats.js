(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CampusDocumentFormats = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Structural admission checks, not antivirus or a complete document parser.
  // ZIP limits use declared sizes; the extraction service must independently
  // enforce actual expanded-byte, memory and execution-time limits.
  const maxFileSize = 10 * 1024 * 1024;
  const zipLimits = Object.freeze({ entries: 2048, expandedBytes: 100 * 1024 * 1024, entryBytes: 32 * 1024 * 1024, ratio: 200 });
  const formats = Object.freeze({
    pdf: Object.freeze({ mime: 'application/pdf', kind: 'pdf' }),
    doc: Object.freeze({ mime: 'application/msword', kind: 'ole' }),
    docx: Object.freeze({ mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kind: 'zip', part: 'word/document.xml' }),
    xls: Object.freeze({ mime: 'application/vnd.ms-excel', kind: 'ole' }),
    xlsx: Object.freeze({ mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kind: 'zip', part: 'xl/workbook.xml' }),
    ppt: Object.freeze({ mime: 'application/vnd.ms-powerpoint', kind: 'ole' }),
    pptx: Object.freeze({ mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', kind: 'zip', part: 'ppt/presentation.xml' })
  });
  const supportedExtensions = Object.freeze(Object.keys(formats));
  const fail = (code, message) => { const error = new Error(message); error.code = code; throw error; };
  function extensionOf(name) {
    const match = typeof name === 'string' && /\.([a-z0-9]+)$/i.exec(name);
    const extension = match && match[1].toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(formats, extension)) fail('UNSUPPORTED_FORMAT', 'Adjunta un PDF, Word (.doc o .docx), Excel (.xls o .xlsx) o PowerPoint (.ppt o .pptx).');
    return extension;
  }
  function safeFilename(name) {
    const extension = extensionOf(name);
    const stem = name.slice(0, -(extension.length + 1)).normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_.-]/g, '_')
      .replace(/\.{2,}/g, '_').replace(/^\.+/, '').slice(0, 100 - extension.length - 1);
    return (stem || 'document') + '.' + extension;
  }
  function bytesOf(input) {
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    fail('MISSING_FILE', 'No s’ha pogut llegir el document.');
  }
  function checkSize(size) {
    if (!Number.isSafeInteger(size) || size < 1) fail('FILE_SIZE', 'El document està buit o no es pot llegir.');
    if (size > maxFileSize) fail('FILE_SIZE', 'Cada document pot ocupar com a màxim 10 MB.');
  }
  function checkZip(bytes, format) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const invalid = () => fail('INVALID_ZIP', 'El document Office està incomplet o té una estructura ZIP no admesa.');
    const u16 = n => view.getUint16(n, true), u32 = n => view.getUint32(n, true);
    if (bytes.length < 22 || u32(0) !== 0x04034b50) invalid();
    let end = -1;
    for (let n = bytes.length - 22, lower = Math.max(0, n - 65535); n >= lower; n--) {
      if (u32(n) === 0x06054b50 && n + 22 + u16(n + 20) === bytes.length) { end = n; break; }
    }
    if (end < 0) invalid();
    const count = u16(end + 10), centralSize = u32(end + 12), centralStart = u32(end + 16);
    // Multi-disk and ZIP64 documents are deliberately outside this small-file policy.
    if (u16(end + 4) || u16(end + 6) || u16(end + 8) !== count || count === 65535 || centralStart === 0xffffffff || centralSize === 0xffffffff || centralStart + centralSize !== end) invalid();
    if (!count || count > zipLimits.entries) fail('ZIP_LIMIT', 'El document Office conté massa fitxers interns.');
    let cursor = centralStart, expanded = 0, packed = 0;
    const names = new Set(), nonemptyParts = new Set(), ranges = [];
    const decoder = new TextDecoder('utf-8', { fatal: true });
    function readName(start, length) {
      let name;
      try { name = decoder.decode(bytes.subarray(start, start + length)); } catch (_) { invalid(); }
      if (!name || /[\u0000-\u001f\u007f\\:]/.test(name) || name.startsWith('/') || name.split('/').some(part => part === '..' || part === '.') || name.includes('//')) {
        fail('ZIP_PATH', 'El document Office conté una ruta interna no admesa.');
      }
      if (/(^|\/)(vbaProject(?:Signature)?\.bin|vbaData\.xml|macros?)(\/|$)/i.test(name)) fail('ZIP_MACROS', 'No s’admeten documents Office amb components de macros.');
      return name;
    }
    function checkExtra(start, length) {
      const stop = start + length;
      while (start < stop) {
        if (start + 4 > stop) invalid();
        const type = u16(start), size = u16(start + 2);
        if (type === 0x0001 || type === 0x9901) invalid();
        start += 4 + size;
        if (start > stop) invalid();
      }
    }
    for (let i = 0; i < count; i++) {
      if (cursor + 46 > end || u32(cursor) !== 0x02014b50) invalid();
      const flags = u16(cursor + 8), method = u16(cursor + 10), crc = u32(cursor + 16);
      const compressed = u32(cursor + 20), uncompressed = u32(cursor + 24);
      const nameLength = u16(cursor + 28), extraLength = u16(cursor + 30), commentLength = u16(cursor + 32);
      const local = u32(cursor + 42), next = cursor + 46 + nameLength + extraLength + commentLength;
      if (flags & 0x2041) fail('ZIP_ENCRYPTED', 'Desprotegeix el document Office abans d’adjuntar-lo.');
      if (next > end || !nameLength || u16(cursor + 34) || ![0, 8].includes(method) || local === 0xffffffff || compressed === 0xffffffff || uncompressed === 0xffffffff) invalid();
      const name = readName(cursor + 46, nameLength);
      if (names.has(name.toLowerCase())) invalid();
      names.add(name.toLowerCase());
      if (uncompressed) nonemptyParts.add(name.toLowerCase());
      checkExtra(cursor + 46 + nameLength, extraLength);
      // Unix symlink entries are not document parts.
      if ((u32(cursor + 38) >>> 16 & 0xf000) === 0xa000) fail('ZIP_PATH', 'El document Office conté un enllaç intern no admès.');
      expanded += uncompressed; packed += compressed;
      if (uncompressed > zipLimits.entryBytes || expanded > zipLimits.expandedBytes || (uncompressed > 65536 && uncompressed / Math.max(1, compressed) > zipLimits.ratio)) fail('ZIP_LIMIT', 'El document Office supera els límits de descompressió.');
      if (method === 0 && compressed !== uncompressed) invalid();
      if (local + 30 > centralStart || u32(local) !== 0x04034b50) invalid();
      const localNameLength = u16(local + 26), localExtraLength = u16(local + 28);
      const dataStart = local + 30 + localNameLength + localExtraLength, dataEnd = dataStart + compressed;
      if (dataEnd > centralStart || u16(local + 6) !== flags || u16(local + 8) !== method || localNameLength !== nameLength) invalid();
      if (readName(local + 30, localNameLength) !== name) invalid();
      checkExtra(local + 30 + localNameLength, localExtraLength);
      let recordEnd = dataEnd;
      if (flags & 8) {
        const descriptor = dataEnd + (dataEnd + 4 <= centralStart && u32(dataEnd) === 0x08074b50 ? 4 : 0);
        if (descriptor + 12 > centralStart || u32(descriptor) !== crc || u32(descriptor + 4) !== compressed || u32(descriptor + 8) !== uncompressed) invalid();
        recordEnd = descriptor + 12;
      } else if (u32(local + 14) !== crc || u32(local + 18) !== compressed || u32(local + 22) !== uncompressed) invalid();
      ranges.push([local, recordEnd]);
      cursor = next;
    }
    if (cursor !== end) invalid();
    ranges.sort((a, b) => a[0] - b[0]);
    let previous = 0;
    for (const [start, stop] of ranges) {
      // No orphan local records, overlapping payloads or unexplained prefix/gaps.
      if (start !== previous) invalid();
      previous = stop;
    }
    if (previous !== centralStart) invalid();
    if (expanded > 65536 && expanded / Math.max(1, packed) > zipLimits.ratio) fail('ZIP_LIMIT', 'El document Office supera els límits de descompressió.');
    if (!nonemptyParts.has('[content_types].xml') || !nonemptyParts.has('_rels/.rels') || !nonemptyParts.has(format.part)) fail('ZIP_FORMAT', 'El contingut del document no correspon al format Office indicat.');
    for (const part of ['word/document.xml', 'xl/workbook.xml', 'ppt/presentation.xml']) {
      if (part !== format.part && names.has(part)) fail('ZIP_FORMAT', 'El document barreja estructures Office incompatibles.');
    }
  }
  function validateBytes(input, name) {
    const extension = extensionOf(name), format = formats[extension], bytes = bytesOf(input);
    checkSize(bytes.byteLength);
    if (format.kind === 'pdf') {
      if (bytes.length < 8 || bytes[0] !== 37 || bytes[1] !== 80 || bytes[2] !== 68 || bytes[3] !== 70 || bytes[4] !== 45 || ![49, 50].includes(bytes[5]) || bytes[6] !== 46 || bytes[7] < 48 || bytes[7] > 57) fail('INVALID_HEADER', 'El fitxer no té una capçalera PDF vàlida.');
    } else if (format.kind === 'ole') {
      const magic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
      // OLE signature does not distinguish Word/Excel/PowerPoint or detect macros.
      if (bytes.length < 512 || magic.some((value, i) => bytes[i] !== value)) fail('INVALID_HEADER', 'El fitxer no té una capçalera Office clàssica vàlida.');
    } else checkZip(bytes, format);
    return { extension, mime: format.mime, filename: safeFilename(name) };
  }
  async function validate(file) {
    if (!file) fail('MISSING_FILE', 'Selecciona un document.');
    checkSize(file.size);
    extensionOf(file.name);
    const source = typeof file.arrayBuffer === 'function' ? file : typeof file.slice === 'function' ? file.slice(0, maxFileSize + 1) : null;
    if (!source || typeof source.arrayBuffer !== 'function') fail('MISSING_FILE', 'No s’ha pogut llegir el document.');
    const bytes = bytesOf(await source.arrayBuffer());
    if (bytes.byteLength !== file.size) fail('FILE_SIZE', 'El document està incomplet; torna a seleccionar-lo.');
    return validateBytes(bytes, file.name);
  }
  return Object.freeze({ formats, supportedExtensions, maxFileSize, zipLimits, safeFilename, validateBytes, validate });
});
