import path from 'path';

const DEFAULT_SYNTHETIC_DATA_DIR = path.join(process.cwd(), '.data', 'syntheticData');
const PUBLIC_DIR = path.resolve(path.join(process.cwd(), 'public'));

function isInsidePublicDir(candidatePath) {
  const resolved = path.resolve(candidatePath);
  return resolved === PUBLIC_DIR || resolved.startsWith(`${PUBLIC_DIR}${path.sep}`);
}

export function getSyntheticDataRootDir() {
  const configured = String(process.env.SYNTHETIC_DATA_FOLDER || '').trim();
  if (!configured) {
    return DEFAULT_SYNTHETIC_DATA_DIR;
  }

  const resolved = path.resolve(
    path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured)
  );

  // Never allow synthetic imports to land in Next.js static assets.
  if (isInsidePublicDir(resolved)) {
    return DEFAULT_SYNTHETIC_DATA_DIR;
  }

  return resolved;
}
