(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CampusDocumentFormats = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Structural admission checks, not antivirus or a complete document parser.
  // ZIP limits use declared sizes; the extraction service must independently
  // enforce actual expanded-byte, memory and execution-time limits.
  const maxFileSize = 50 * 1024 * 1024;
  const zipLimits = Object.freeze({ entries: 2048, expandedBytes: 200 * 1024 * 1024, entryBytes: 64 * 1024 * 1024, directoryBytes: 4 * 1024 * 1024, ratio: 200 });
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
    if (!Object.prototype.hasOwnProperty.call(formats, extension)) fail('UNSUPPORTED_FORMAT', 'Adjunta un PDF, un document de text (.doc o .docx), un full de càlcul (.xls o .xlsx) o una presentació (.ppt o .pptx).');
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
    if (size > maxFileSize) fail('FILE_SIZE', 'Cada document pot ocupar com a màxim 50 MB.');
  }
  // One structural parser is driven either by in-memory bytes (server) or
  // bounded Blob slices (browser). Payloads are never fully loaded or decompressed.
  function* inspectZip(size, format) {
    const invalid = () => fail('INVALID_ZIP', 'El document està incomplet o té una estructura ZIP no admesa.');
    const viewOf = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (size < 22) invalid();
    const first = viewOf(yield [0, 4]);
    if (first.getUint32(0, true) !== 0x04034b50) invalid();
    const tailStart = Math.max(0, size - 65557), tail = yield [tailStart, size - tailStart], tailView = viewOf(tail);
    let end = -1;
    for (let n = tail.length - 22; n >= 0; n--) {
      if (tailView.getUint32(n, true) === 0x06054b50 && n + 22 + tailView.getUint16(n + 20, true) === tail.length) { end = n; break; }
    }
    if (end < 0) invalid();
    const count = tailView.getUint16(end + 10, true), centralSize = tailView.getUint32(end + 12, true), centralStart = tailView.getUint32(end + 16, true);
    if (tailView.getUint16(end + 4, true) || tailView.getUint16(end + 6, true) || tailView.getUint16(end + 8, true) !== count || count === 65535 || centralStart === 0xffffffff || centralSize === 0xffffffff || centralStart + centralSize !== tailStart + end) invalid();
    if (!count || count > zipLimits.entries) fail('ZIP_LIMIT', 'El document conté massa fitxers interns.');
    if (centralSize > zipLimits.directoryBytes) fail('ZIP_LIMIT', 'El directori intern del document és massa gran.');
    const directory = yield [centralStart, centralSize], view = viewOf(directory);
    const u16 = n => view.getUint16(n, true), u32 = n => view.getUint32(n, true);
    let cursor = 0, expanded = 0, packed = 0, localMetadata = 0;
    const names = new Set(), nonemptyParts = new Set(), ranges = [];
    const decoder = new TextDecoder('utf-8', { fatal: true });
    function readName(bytes) {
      let name;
      try { name = decoder.decode(bytes); } catch (_) { invalid(); }
      if (!name || /[\u0000-\u001f\u007f\\:]/.test(name) || name.startsWith('/') || name.split('/').some(part => part === '..' || part === '.') || name.includes('//')) fail('ZIP_PATH', 'El document conté una ruta interna no admesa.');
      if (/(^|\/)(vbaProject(?:Signature)?\.bin|vbaData\.xml|macros?)(\/|$)/i.test(name)) fail('ZIP_MACROS', 'No s’admeten documents amb components de macros.');
      return name;
    }
    function checkExtra(bytes) {
      const extra = viewOf(bytes); let position = 0;
      while (position < bytes.length) {
        if (position + 4 > bytes.length) invalid();
        const type = extra.getUint16(position, true), length = extra.getUint16(position + 2, true);
        if (type === 0x0001 || type === 0x9901) invalid();
        position += 4 + length;
        if (position > bytes.length) invalid();
      }
    }
    for (let i = 0; i < count; i++) {
      if (cursor + 46 > directory.length || u32(cursor) !== 0x02014b50) invalid();
      const flags = u16(cursor + 8), method = u16(cursor + 10), crc = u32(cursor + 16);
      const compressed = u32(cursor + 20), uncompressed = u32(cursor + 24);
      const nameLength = u16(cursor + 28), extraLength = u16(cursor + 30), commentLength = u16(cursor + 32);
      const local = u32(cursor + 42), next = cursor + 46 + nameLength + extraLength + commentLength;
      if (flags & 0x2041) fail('ZIP_ENCRYPTED', 'Desprotegeix el document abans d’adjuntar-lo.');
      if (next > directory.length || !nameLength || u16(cursor + 34) || ![0, 8].includes(method) || local === 0xffffffff || compressed === 0xffffffff || uncompressed === 0xffffffff) invalid();
      const name = readName(directory.subarray(cursor + 46, cursor + 46 + nameLength));
      if (names.has(name.toLowerCase())) invalid();
      names.add(name.toLowerCase());
      if (uncompressed) nonemptyParts.add(name.toLowerCase());
      checkExtra(directory.subarray(cursor + 46 + nameLength, cursor + 46 + nameLength + extraLength));
      if ((u32(cursor + 38) >>> 16 & 0xf000) === 0xa000) fail('ZIP_PATH', 'El document conté un enllaç intern no admès.');
      expanded += uncompressed; packed += compressed;
      if (uncompressed > zipLimits.entryBytes || expanded > zipLimits.expandedBytes || (uncompressed > 65536 && uncompressed / Math.max(1, compressed) > zipLimits.ratio)) fail('ZIP_LIMIT', 'El document supera els límits de descompressió.');
      if (method === 0 && compressed !== uncompressed) invalid();
      if (local + 30 > centralStart) invalid();
      const header = viewOf(yield [local, 30]);
      if (header.getUint32(0, true) !== 0x04034b50) invalid();
      const localNameLength = header.getUint16(26, true), localExtraLength = header.getUint16(28, true);
      const dataStart = local + 30 + localNameLength + localExtraLength, dataEnd = dataStart + compressed;
      if (dataEnd > centralStart || header.getUint16(6, true) !== flags || header.getUint16(8, true) !== method || localNameLength !== nameLength) invalid();
      localMetadata += 30 + localNameLength + localExtraLength;
      if (localMetadata > zipLimits.directoryBytes) fail('ZIP_LIMIT', 'Les metadades internes del document són massa grans.');
      const localFields = yield [local + 30, localNameLength + localExtraLength];
      if (readName(localFields.subarray(0, localNameLength)) !== name) invalid();
      checkExtra(localFields.subarray(localNameLength));
      let recordEnd = dataEnd;
      if (flags & 8) {
        if (dataEnd + 12 > centralStart) invalid();
        const descriptor = viewOf(yield [dataEnd, Math.min(16, centralStart - dataEnd)]);
        const offset = descriptor.getUint32(0, true) === 0x08074b50 ? 4 : 0;
        if (offset + 12 > descriptor.byteLength || descriptor.getUint32(offset, true) !== crc || descriptor.getUint32(offset + 4, true) !== compressed || descriptor.getUint32(offset + 8, true) !== uncompressed) invalid();
        recordEnd = dataEnd + offset + 12;
      } else if (header.getUint32(14, true) !== crc || header.getUint32(18, true) !== compressed || header.getUint32(22, true) !== uncompressed) invalid();
      ranges.push([local, recordEnd]);
      cursor = next;
    }
    if (cursor !== directory.length) invalid();
    ranges.sort((a, b) => a[0] - b[0]);
    let previous = 0;
    for (const [start, stop] of ranges) {
      if (start !== previous) invalid();
      previous = stop;
    }
    if (previous !== centralStart) invalid();
    if (expanded > 65536 && expanded / Math.max(1, packed) > zipLimits.ratio) fail('ZIP_LIMIT', 'El document supera els límits de descompressió.');
    if (!nonemptyParts.has('[content_types].xml') || !nonemptyParts.has('_rels/.rels') || !nonemptyParts.has(format.part)) fail('ZIP_FORMAT', 'El contingut del document no correspon al format indicat.');
    for (const part of ['word/document.xml', 'xl/workbook.xml', 'ppt/presentation.xml']) if (part !== format.part && names.has(part)) fail('ZIP_FORMAT', 'El fitxer combina formats de document incompatibles.');
  }
  function checkZip(bytes, format) {
    const parser = inspectZip(bytes.length, format); let step = parser.next();
    while (!step.done) { const [offset, length] = step.value; step = parser.next(bytes.subarray(offset, offset + length)); }
  }
  function validateBytes(input, name) {
    const extension = extensionOf(name), format = formats[extension], bytes = bytesOf(input);
    checkSize(bytes.byteLength);
    if (format.kind === 'pdf') {
      if (bytes.length < 8 || bytes[0] !== 37 || bytes[1] !== 80 || bytes[2] !== 68 || bytes[3] !== 70 || bytes[4] !== 45 || ![49, 50].includes(bytes[5]) || bytes[6] !== 46 || bytes[7] < 48 || bytes[7] > 57) fail('INVALID_HEADER', 'El fitxer no té una capçalera PDF vàlida.');
    } else if (format.kind === 'ole') {
      const magic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
      // OLE signature does not distinguish Word/Excel/PowerPoint or detect macros.
      if (bytes.length < 512 || magic.some((value, i) => bytes[i] !== value)) fail('INVALID_HEADER', 'El fitxer no té una capçalera vàlida per a aquest format.');
    } else checkZip(bytes, format);
    return { extension, mime: format.mime, filename: safeFilename(name) };
  }
  async function validate(file) {
    if (!file) fail('MISSING_FILE', 'Selecciona un document.');
    checkSize(file.size);
    const extension = extensionOf(file.name), format = formats[extension];
    // Real browser Files always support slice. Small legacy test/adaptor inputs
    // may expose only arrayBuffer; never use that fallback for large files.
    let smallBytes;
    if (typeof file.slice !== 'function') {
      if (file.size > 1024 * 1024 || typeof file.arrayBuffer !== 'function') fail('MISSING_FILE', 'No s’ha pogut llegir el document per fragments.');
      smallBytes = bytesOf(await file.arrayBuffer());
      if (smallBytes.length !== file.size) fail('FILE_SIZE', 'El document està incomplet; torna a seleccionar-lo.');
    }
    async function read(offset, length) {
      if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > file.size) fail('INVALID_ZIP', 'El document està incomplet.');
      const bytes = smallBytes ? smallBytes.subarray(offset, offset + length) : bytesOf(await file.slice(offset, offset + length).arrayBuffer());
      if (bytes.length !== length) fail('FILE_SIZE', 'El document està incomplet; torna a seleccionar-lo.');
      return bytes;
    }
    if (format.kind !== 'zip') return validateBytes(await read(0, Math.min(file.size, format.kind === 'pdf' ? 8 : 512)), file.name);
    const parser = inspectZip(file.size, format); let step = parser.next();
    while (!step.done) { const [offset, length] = step.value; step = parser.next(await read(offset, length)); }
    return { extension, mime: format.mime, filename: safeFilename(file.name) };
  }
  return Object.freeze({ formats, supportedExtensions, maxFileSize, zipLimits, safeFilename, validateBytes, validate });
});
