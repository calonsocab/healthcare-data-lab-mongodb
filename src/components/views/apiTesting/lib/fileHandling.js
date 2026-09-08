import { validateFileBasics } from '@/lib/uploads/validation';

export const TEMPLATE_MAX_BYTES = 10 * 1024 * 1024;
export const TEMPLATE_EXTENSIONS = ['.opt', '.xml'];
export const TEMPLATE_MIME_TYPES = [
  'application/xml',
  'text/xml',
  'application/octet-stream',
  'text/plain',
];

export const COMPOSITION_MAX_BYTES = 10 * 1024 * 1024;
export const COMPOSITION_EXTENSIONS = ['.json'];
export const COMPOSITION_MIME_TYPES = [
  'application/json',
  'text/json',
  'application/octet-stream',
  'text/plain',
];

export function validateSelectedFiles(selectedFiles, options) {
  const validFiles = [];
  const errors = [];

  for (const file of Array.from(selectedFiles || [])) {
    const error = validateFileBasics(file, options);
    if (error) {
      errors.push(`${file.name}: ${error}`);
      continue;
    }
    validFiles.push(file);
  }

  return { validFiles, errors };
}

export function mergeUniqueFiles(existingFiles, incomingFiles) {
  const merged = new Map();
  for (const file of [...existingFiles, ...incomingFiles]) {
    merged.set(`${file.name}:${file.size}:${file.lastModified}`, file);
  }
  return Array.from(merged.values());
}
