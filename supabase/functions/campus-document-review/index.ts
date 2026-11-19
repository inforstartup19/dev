import '../../../sites/incforstartup/public/campus-document-formats.js';
import { createHandler } from './handler.mjs';

Deno.serve(createHandler({
  env: (key) => Deno.env.get(key),
  formats: globalThis.CampusDocumentFormats,
}));
