import { NextResponse } from 'next/server';

export const ENV_CONTROL_MODE = Object.freeze({
  NORMAL: 'normal',
  PAUSED: 'paused',
  READ_ONLY: 'read_only'
});

export const ENV_CONTROL_CAPABILITY = Object.freeze({
  READ: 'read',
  WRITE: 'write',
  OPS: 'ops',
  JOB: 'job',
  CANCEL: 'cancel'
});

function normalizeMode(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === ENV_CONTROL_MODE.PAUSED) return ENV_CONTROL_MODE.PAUSED;
  if (raw === ENV_CONTROL_MODE.READ_ONLY || raw === 'readonly') return ENV_CONTROL_MODE.READ_ONLY;
  return ENV_CONTROL_MODE.NORMAL;
}

export async function getEnvironmentControl(coreDb, envId) {
  const id = String(envId || '').trim();
  if (!id) {
    return { mode: ENV_CONTROL_MODE.NORMAL, reason: null, updatedAt: null, updatedBy: null };
  }

  let doc = null;
  try {
    doc = await coreDb.collection('environment_controls').findOne(
      { envId: id },
      { projection: { mode: 1, reason: 1, updatedAt: 1, updatedBy: 1 } }
    );
  } catch {
    doc = null;
  }

  return {
    mode: normalizeMode(doc?.mode),
    reason: doc?.reason || null,
    updatedAt: doc?.updatedAt || null,
    updatedBy: doc?.updatedBy || null
  };
}

function isBlocked(mode, capability) {
  if (capability === ENV_CONTROL_CAPABILITY.READ) return false;
  if (capability === ENV_CONTROL_CAPABILITY.CANCEL) return false;
  if (mode === ENV_CONTROL_MODE.PAUSED) return true;
  if (mode === ENV_CONTROL_MODE.READ_ONLY) {
    return capability === ENV_CONTROL_CAPABILITY.WRITE || capability === ENV_CONTROL_CAPABILITY.JOB || capability === ENV_CONTROL_CAPABILITY.OPS;
  }
  return false;
}

export async function enforceEnvironmentControl(coreDb, envId, capability, meta = {}) {
  const control = await getEnvironmentControl(coreDb, envId);
  if (!isBlocked(control.mode, capability)) return null;

  const code = control.mode === ENV_CONTROL_MODE.PAUSED ? 'ENV_PAUSED' : 'ENV_READ_ONLY';
  const message =
    control.mode === ENV_CONTROL_MODE.PAUSED
      ? 'Environment is paused by platform admin'
      : 'Environment is in read-only mode by platform admin';

  return NextResponse.json(
    {
      error: message,
      code,
      envId: String(envId || '').trim() || null,
      mode: control.mode,
      reason: control.reason,
      ...meta
    },
    { status: 423 }
  );
}

