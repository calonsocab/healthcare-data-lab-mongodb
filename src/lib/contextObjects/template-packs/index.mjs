import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  exportAllTemplatePacks,
  exportPackToWebTemplate,
  loadTemplatePacks,
  validateTemplatePacks,
  loadSnapshotExports,
  compareVersioningAgainstSnapshots
} from './engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const TEMPLATE_PACKS_DIR = __dirname;

export {
  exportAllTemplatePacks,
  exportPackToWebTemplate,
  loadTemplatePacks,
  validateTemplatePacks,
  loadSnapshotExports,
  compareVersioningAgainstSnapshots
};
