// src/lib/uploads/validation.js
export function getFileExtension(fileName = '') {
  const match = String(fileName).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? `.${match[1]}` : '';
}

export function isSafeFileName(fileName = '') {
  if (!fileName || typeof fileName !== 'string') return false;
  if (fileName.trim() !== fileName) return false;
  if (fileName.includes('..')) return false;
  if (fileName.includes('/') || fileName.includes('\\')) return false;
  if (fileName.includes('\0')) return false;
  return true;
}

export function validateFileBasics(file, {
  allowedExtensions = null,
  allowedMimeTypes = null,
  maxBytes = null,
  allowMissingType = true,
  allowOctetStream = true,
  requireSafeName = false
} = {}) {
  if (!file || typeof file === 'string') {
    return 'No file uploaded';
  }

  const name = file.name || '';
  if (requireSafeName && !isSafeFileName(name)) {
    return 'Invalid file name';
  }

  if (Array.isArray(allowedExtensions) && allowedExtensions.length > 0) {
    const ext = getFileExtension(name);
    if (!allowedExtensions.includes(ext)) {
      return `Invalid file type. Allowed: ${allowedExtensions.join(', ')}`;
    }
  }

  const mime = (file.type || '').toLowerCase();
  if (Array.isArray(allowedMimeTypes) && allowedMimeTypes.length > 0) {
    if (mime) {
      if (!allowedMimeTypes.includes(mime)) {
        if (!(allowOctetStream && mime === 'application/octet-stream')) {
          return 'Invalid file type';
        }
      }
    } else if (!allowMissingType) {
      return 'Missing file type';
    }
  }

  if (Number.isFinite(maxBytes) && maxBytes > 0) {
    if (typeof file.size === 'number' && file.size > maxBytes) {
      return `File too large. Maximum size is ${Math.round(maxBytes / (1024 * 1024))}MB.`;
    }
  }

  return null;
}
