#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TEMPLATE_PACKS_DIR,
  exportAllTemplatePacks
} from '../src/lib/contextObjects/template-packs/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outDir = path.resolve(projectRoot, 'dist', 'templates');

try {
  const exported = exportAllTemplatePacks({
    baseDir: TEMPLATE_PACKS_DIR,
    outDir
  });

  process.stdout.write(`Exported ${exported.length} template(s) to ${outDir}\n`);
  exported.forEach((item) => {
    process.stdout.write(`- ${item.metadata.templateId}@${item.metadata.version}\n`);
  });
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
