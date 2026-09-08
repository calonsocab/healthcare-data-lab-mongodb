// src/app/api/kehrnel/version/route.js

import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';

function detectKehrnelVersionFromPython() {
  const script = [
    'import importlib.metadata as m',
    'try:',
    '  print(m.version("kehrnel"))',
    'except Exception:',
    '  try:',
    '    import kehrnel as k',
    '    print(getattr(k, "__version__", ""))',
    '  except Exception:',
    '    print("")'
  ].join('\n');

  for (const bin of ['python3', 'python']) {
    try {
      const output = execFileSync(bin, ['-c', script], {
        timeout: 5000,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
      const version = output.trim();
      if (version) return version;
    } catch (error) {
      // Interpreter missing or package unavailable are expected in many deployments.
      // Continue to next fallback without noisy build logs.
    }
  }

  return null;
}

/**
 * GET /api/kehrnel/version
 *
 * Detects the kehrnel version installed in the Docker instance.
 * This endpoint attempts to execute `kehrnel --version` if available,
 * or reads from environment variables / package metadata.
 */
export async function GET() {
  try {
    // Method 1: Check environment variable (set in Dockerfile)
    const envVersion = process.env.KEHRNEL_VERSION;
    if (envVersion) {
      return NextResponse.json({
        version: envVersion,
        source: 'environment',
        available: true
      });
    }

    // Method 2: Try to detect installed Python package quietly
    if (typeof process !== 'undefined' && process.versions?.node) {
      const version = detectKehrnelVersionFromPython();
      if (version) {
        return NextResponse.json({
          version,
          source: 'python',
          available: true
        });
      }
    }

    // Method 3: Check if a version file exists (custom deployment)
    // /app/kehrnel-version.txt could be created during Docker build
    try {
      const fs = require('fs');
      const path = require('path');
      const versionFilePath = path.join(process.cwd(), 'kehrnel-version.txt');

      if (fs.existsSync(versionFilePath)) {
        const fileVersion = fs.readFileSync(versionFilePath, 'utf8').trim();
        if (fileVersion) {
          return NextResponse.json({
            version: fileVersion,
            source: 'file',
            available: true
          });
        }
      }
    } catch (fsError) {
      console.warn('Could not read kehrnel version file:', fsError.message);
    }

    // Kehrnel not detected
    return NextResponse.json({
      version: null,
      source: null,
      available: false,
      message: 'Kehrnel not detected. Set KEHRNEL_VERSION env var or install kehrnel package.'
    });

  } catch (error) {
    console.error('Error in kehrnel version detection:', error);
    return NextResponse.json(
      {
        version: null,
        available: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}
