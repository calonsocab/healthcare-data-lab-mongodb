import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const hostRoot = path.resolve(__dirname, '..');
const sherpaRoot = process.env.DEMO_SHERPA_DIR
  ? path.resolve(process.env.DEMO_SHERPA_DIR)
  : path.resolve(hostRoot, '..', 'demo-sherpa');

const run = (command, args, options = {}) => {
  execFileSync(command, args, {
    cwd: options.cwd || hostRoot,
    stdio: 'inherit',
    env: process.env,
  });
};

if (!fs.existsSync(sherpaRoot)) {
  console.error(`[sherpa:refresh-local] Could not find demo-sherpa at ${sherpaRoot}`);
  process.exit(1);
}

const sherpaPackagePath = path.join(sherpaRoot, 'package.json');
if (!fs.existsSync(sherpaPackagePath)) {
  console.error(`[sherpa:refresh-local] Missing package.json in ${sherpaRoot}`);
  process.exit(1);
}

const sherpaPackage = JSON.parse(fs.readFileSync(sherpaPackagePath, 'utf8'));
const expectedTarballName = `${sherpaPackage.name}-${sherpaPackage.version}.tgz`;
const expectedTarballPath = path.join(sherpaRoot, expectedTarballName);

console.log(`[sherpa:refresh-local] Packing ${sherpaPackage.name}@${sherpaPackage.version} from ${sherpaRoot}`);
run('npm', ['pack', '--silent'], { cwd: sherpaRoot });

if (!fs.existsSync(expectedTarballPath)) {
  console.error(`[sherpa:refresh-local] Expected tarball was not created: ${expectedTarballPath}`);
  process.exit(1);
}

console.log(`[sherpa:refresh-local] Installing ${expectedTarballPath} into ${hostRoot}`);
run('npm', ['install', '--no-save', '--package-lock=false', expectedTarballPath], { cwd: hostRoot });

console.log('[sherpa:refresh-local] Done. Set ENABLE_LOCAL_SHERPA=true and restart the HDL dev server so Next picks up the refreshed package.');
