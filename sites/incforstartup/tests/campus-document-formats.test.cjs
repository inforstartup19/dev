const test = require('node:test');
const assert = require('node:assert/strict');
const { deflateRawSync } = require('node:zlib');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const formats = require('../public/campus-document-formats.js');

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
// Real stored/deflated ZIP records and optional descriptors, without dependencies.
// Deliberate overrides below model hostile metadata, not useful documents.
function zip(entries, comment = '') {
  const locals = [], directory = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name), data = Buffer.from(entry.data ?? '<root/>');
    const method = entry.method ?? 0, flags = entry.flags ?? 0;
    const packed = entry.packed ?? (method === 8 ? deflateRawSync(data) : data);
    const expanded = entry.expanded ?? data.length, crc = crc32(data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6); local.writeUInt16LE(method, 8);
    if (!(flags & 8)) { local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(expanded, 22); }
    local.writeUInt16LE(name.length, 26); name.copy(local, 30);
    let descriptor = Buffer.alloc(0);
    if (flags & 8) {
      descriptor = Buffer.alloc(entry.noDescriptorSignature ? 12 : 16);
      const position = descriptor.length === 16 ? 4 : 0;
      if (position) descriptor.writeUInt32LE(0x08074b50);
      descriptor.writeUInt32LE(crc, position); descriptor.writeUInt32LE(packed.length, position + 4); descriptor.writeUInt32LE(expanded, position + 8);
    }
    locals.push(local, packed, descriptor);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8); central.writeUInt16LE(method, 10); central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(expanded, 24); central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(entry.attributes ?? 0, 38); central.writeUInt32LE(offset, 42); name.copy(central, 46);
    directory.push(central); offset += local.length + packed.length + descriptor.length;
  }
  const central = Buffer.concat(directory), commentBytes = Buffer.from(comment), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(commentBytes.length, 20);
  return Buffer.concat([...locals, central, end, commentBytes]);
}
function office(extension, more = [], overrides = {}) {
  const part = { docx: 'word/document.xml', xlsx: 'xl/workbook.xml', pptx: 'ppt/presentation.xml' }[extension];
  return zip(['[Content_Types].xml', '_rels/.rels', part].map(name => ({ name, ...overrides })).concat(more));
}
const rejects = (bytes, filename, code) => assert.throws(() => formats.validateBytes(bytes, filename), error => error.code === code);

test('exports identical browser/CommonJS contract without external dependencies', () => {
  const context = vm.createContext({ TextDecoder, Uint8Array, ArrayBuffer, DataView });
  vm.runInContext(readFileSync(require.resolve('../public/campus-document-formats.js'), 'utf8'), context);
  assert.equal(typeof context.CampusDocumentFormats.validate, 'function');
  assert.deepEqual(Object.keys(context.CampusDocumentFormats), Object.keys(formats));
  assert.deepEqual(formats.supportedExtensions, ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);
});

test('PDF and each legacy Office extension have explicit MIME and safe names', () => {
  const pdf = formats.validateBytes(Buffer.from('%PDF-1.7\n%%EOF'), 'Memòria final.PDF');
  assert.deepEqual(pdf, { extension: 'pdf', mime: 'application/pdf', filename: 'Memoria_final.pdf' });
  const ole = Buffer.alloc(512); Buffer.from('d0cf11e0a1b11ae1', 'hex').copy(ole);
  for (const ext of ['doc', 'xls', 'ppt']) {
    const result = formats.validateBytes(ole, `pilot.${ext}`);
    assert.equal(result.extension, ext); assert.equal(result.mime, formats.formats[ext].mime);
  }
  // OLE admission intentionally cannot distinguish these three legacy formats.
  rejects(ole.subarray(0, 8), 'truncated.doc', 'INVALID_HEADER');
  rejects(ole, 'renamed.pdf', 'INVALID_HEADER');
  rejects(Buffer.from('%PDF-1.7'), 'renamed.doc', 'INVALID_HEADER');
  rejects(Buffer.from('%PDF-1.7'), 'macro.docm', 'UNSUPPORTED_FORMAT');
  assert.match(formats.safeFilename('../../a<bad>résumé.XLSX'), /^[A-Za-z0-9_.-]+\.xlsx$/);
  assert.ok(!formats.safeFilename('../../a<bad>résumé.XLSX').includes('..'));
  assert.ok(formats.safeFilename('a'.repeat(300) + '.pptx').length <= 100);
});

test('modern Office admits stored or deflated ZIPs with appropriate document parts', () => {
  for (const extension of ['docx', 'xlsx', 'pptx']) {
    for (const overrides of [{}, { method: 8 }, { method: 8, flags: 8 }, { method: 8, flags: 8, noDescriptorSignature: true }]) {
      const result = formats.validateBytes(office(extension, [], overrides), `project.${extension}`);
      assert.equal(result.extension, extension); assert.equal(result.mime, formats.formats[extension].mime);
    }
  }
  assert.equal(formats.validateBytes(zip([
    { name: '[Content_Types].xml' }, { name: '_rels/.rels' }, { name: 'word/document.xml' }, { name: 'word/media/imatge_à.png' }
  ], 'an ordinary ZIP comment'), 'notes.docx').extension, 'docx');
});

test('mismatched Office extension, missing parts and ambiguous roots are rejected', () => {
  rejects(office('docx'), 'renamed.xlsx', 'ZIP_FORMAT');
  rejects(zip([{ name: 'word/document.xml' }]), 'incomplete.docx', 'ZIP_FORMAT');
  rejects(office('docx', [], { data: '' }), 'empty-parts.docx', 'ZIP_FORMAT');
  rejects(office('pptx', [{ name: 'xl/workbook.xml' }]), 'mixed.pptx', 'ZIP_FORMAT');
  rejects(office('docx', [{ name: 'WORD/DOCUMENT.XML' }]), 'duplicate.docx', 'INVALID_ZIP');
});

test('encrypted Office, macro components, path traversal and symlinks are rejected', () => {
  for (const flags of [1, 64, 8192]) rejects(office('docx', [], { flags }), 'protected.docx', 'ZIP_ENCRYPTED');
  for (const name of ['word/vbaProject.bin', 'xl/VBAPROJECTSIGNATURE.BIN', 'word/vbaData.xml', 'macros/payload']) rejects(office('docx', [{ name }]), 'macro.docx', 'ZIP_MACROS');
  for (const name of ['../outside', 'word/../../outside', '/absolute', 'C:/absolute', 'word\\document.xml', 'word/./item', 'word//item', 'word/evil\0.xml']) rejects(office('docx', [{ name }]), 'traversal.docx', 'ZIP_PATH');
  rejects(office('docx', [{ name: 'word/link', attributes: (0xa000 << 16) >>> 0 }]), 'link.docx', 'ZIP_PATH');
});

test('ZIP entry count, expansion sizes and suspicious compression ratios are bounded', () => {
  rejects(office('docx', Array.from({ length: 2046 }, (_, i) => ({ name: `word/item${i}.xml` }))), 'many.docx', 'ZIP_LIMIT');
  rejects(office('docx', [{ name: 'word/huge.xml', method: 8, packed: Buffer.alloc(300000), expanded: 33 * 1024 * 1024 }]), 'huge.docx', 'ZIP_LIMIT');
  rejects(office('docx', [{ name: 'word/bomb.xml', method: 8, packed: Buffer.alloc(32), expanded: 1024 * 1024 }]), 'bomb.docx', 'ZIP_LIMIT');
  rejects(office('docx', Array.from({ length: 4 }, (_, i) => ({ name: `word/large${i}.xml`, method: 8, packed: Buffer.alloc(512 * 1024), expanded: 30 * 1024 * 1024 }))), 'total.docx', 'ZIP_LIMIT');
});

test('truncation, tampered directory/local records, overlapping payloads and ZIP64 are rejected', () => {
  const good = office('docx');
  rejects(good.subarray(0, -1), 'short.docx', 'INVALID_ZIP');
  rejects(Buffer.concat([good, Buffer.from('trailing bytes')]), 'extra.docx', 'INVALID_ZIP');
  const central = good.readUInt32LE(good.length - 6);
  for (const mutate of [
    b => b.writeUInt32LE(0x04034b50, central),
    b => b.writeUInt16LE(1, b.length - 18),
    b => b.writeUInt32LE(0xffffffff, central + 20),
    b => b.writeUInt32LE(1, central + 42),
    b => b.writeUInt32LE(100000, 18),
    b => b.writeUInt16LE(99, central + 10),
    b => b.writeUInt16LE(0xffff, 28),
    b => b.writeUInt16LE(0xffff, central + 28)
  ]) { const broken = Buffer.from(good); mutate(broken); rejects(broken, 'broken.docx', 'INVALID_ZIP'); }
  const descriptor = office('docx', [], { flags: 8 });
  const brokenDescriptor = Buffer.from(descriptor); brokenDescriptor[30 + Buffer.byteLength('[Content_Types].xml') + 7 + 4] ^= 1;
  rejects(brokenDescriptor, 'descriptor.docx', 'INVALID_ZIP');
});

test('upload validates actual bytes, ignores unreliable browser MIME and stops oversized reads', async () => {
  const file = new File([office('xlsx')], 'Budget.XLSX', { type: 'application/octet-stream' });
  assert.equal((await formats.validate(file)).mime, formats.formats.xlsx.mime);
  await assert.rejects(formats.validate({ name: 'big.pdf', size: 10485761, arrayBuffer() { throw Error('must not read'); } }), error => error.code === 'FILE_SIZE');
  await assert.rejects(formats.validate(new File([], 'empty.pdf')), error => error.code === 'FILE_SIZE');
  await assert.rejects(formats.validate({ name: 'cut.pdf', size: 20, arrayBuffer: async () => Buffer.from('%PDF-1.7') }), error => error.code === 'FILE_SIZE');
  await assert.rejects(formats.validate(new File(['not a PDF'], 'fake.pdf')), error => error.code === 'INVALID_HEADER');
  const backing = Buffer.concat([Buffer.from('prefix'), Buffer.from('%PDF-1.7\n%%EOF'), Buffer.from('suffix')]);
  assert.equal(formats.validateBytes(backing.subarray(6, -6), 'view.pdf').extension, 'pdf');
});
