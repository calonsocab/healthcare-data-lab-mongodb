"use client";

import { useMemo } from 'react';
import { DemoSherpaCaptureBridge, DemoSherpaGuide } from 'demo-sherpa';
import { getSherpaRouteContext } from '@/lib/demoSherpa/routeContext';

const parseBooleanFlag = (value, fallback = true) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const parseNumberOrFallback = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeRole = (value) => String(value || '').trim().toLowerCase();

export default function HealthcareDataLabSherpa({ user, team, isIndividual = false }) {
  const enabled = parseBooleanFlag(process.env.NEXT_PUBLIC_SHERPA_ENABLED, false);
  const resolvedUserRole = useMemo(() => {
    const explicitRole = normalizeRole(team?.currentUserRole || team?.userRole);
    if (explicitRole) return explicitRole;
    if (isIndividual) return 'owner';
    return '';
  }, [isIndividual, team?.currentUserRole, team?.userRole]);

  const currentMember = useMemo(() => {
    const userEmail = normalizeEmail(user?.email);
    return (team?.members || []).find((member) => normalizeEmail(member?.email) === userEmail) || null;
  }, [team?.members, user?.email]);

  const currentUser = useMemo(() => {
    const roles = [];
    if (resolvedUserRole) roles.push(resolvedUserRole);
    if (!roles.length && currentMember?.role) roles.push(currentMember.role);
    if (isIndividual && !roles.length) roles.push('owner');

    return {
      id: user?.id || user?.email || '',
      name: user?.name || team?.name || 'Healthcare Data Lab User',
      email: user?.email || '',
      roles,
    };
  }, [currentMember?.role, isIndividual, resolvedUserRole, team?.name, user?.email, user?.id, user?.name]);

  const projectOwnerEmails = useMemo(() => {
    if (Array.isArray(team?.members) && team.members.length) {
      const owners = team.members
        .filter((member) => ['owner', 'admin'].includes(String(member?.role || '').toLowerCase()))
        .map((member) => String(member?.email || '').trim())
        .filter(Boolean);
      if (owners.length) return owners;
    }

    if (['owner', 'admin'].includes(resolvedUserRole) && user?.email) {
      return [user.email];
    }

    if (isIndividual && user?.email) {
      return [user.email];
    }

    return [];
  }, [isIndividual, resolvedUserRole, team?.members, user?.email]);

  const logoSrc = String(
    process.env.NEXT_PUBLIC_SHERPA_PLAYER_LOGO_URL
    || team?.logoIcon
    || '/icon.svg'
  ).trim();

  const assistantLogoSrc = String(
    process.env.NEXT_PUBLIC_SHERPA_ASSISTANT_LOGO_URL
    || logoSrc
  ).trim();

  const overviewSections = useMemo(
    () => [
      { id: 'narration', label: 'Narration' },
      { id: 'step-outline', label: 'Walkthrough', renderMode: 'list' },
      { id: 'why-mongo', label: 'Platform value', renderMode: 'list' },
      {
        id: 'learning-goals',
        label: 'Learning goals',
        renderMode: 'list',
        placeholder: '<ul><li>What should a new user understand on this screen?</li></ul>',
      },
    ],
    []
  );

  const demoContext = useMemo(
    () => ({
      projectSlug: process.env.NEXT_PUBLIC_SHERPA_PROJECT_SLUG || 'mongodb-industry-solutions',
      projectName: process.env.NEXT_PUBLIC_SHERPA_PROJECT_NAME || 'MongoDB Industry Solutions',
      demoSlug: process.env.NEXT_PUBLIC_SHERPA_DEMO_SLUG || 'healthcare-data-lab',
      demoName: process.env.NEXT_PUBLIC_SHERPA_DEMO_NAME || 'Healthcare Data Lab',
      demoDescription:
        process.env.NEXT_PUBLIC_SHERPA_DEMO_DESCRIPTION
        || 'Guided onboarding, walkthroughs, and reusable presenter notes for the Healthcare Data Lab workspace.',
    }),
    []
  );

  const defaultPosition = useMemo(
    () => ({
      right: parseNumberOrFallback(process.env.NEXT_PUBLIC_SHERPA_DEFAULT_RIGHT, 16),
      top: parseNumberOrFallback(process.env.NEXT_PUBLIC_SHERPA_DEFAULT_TOP, 16),
    }),
    []
  );

  if (!enabled) {
    return null;
  }

  return (
    <>
      <DemoSherpaCaptureBridge />
      <DemoSherpaGuide
        enabled={enabled}
        title={process.env.NEXT_PUBLIC_SHERPA_TITLE || 'Healthcare Data Lab Guide'}
        studioTitle={process.env.NEXT_PUBLIC_SHERPA_STUDIO_TITLE || 'Healthcare Data Lab Guide Studio'}
        routeContextResolver={getSherpaRouteContext}
        ttsEndpoint={process.env.NEXT_PUBLIC_SHERPA_TTS_ENDPOINT || ''}
        transcribeEndpoint={process.env.NEXT_PUBLIC_SHERPA_TRANSCRIBE_ENDPOINT || ''}
        translateEndpoint={process.env.NEXT_PUBLIC_SHERPA_TRANSLATE_ENDPOINT || ''}
        playerLogoSrc={logoSrc}
        assistantLogoSrc={assistantLogoSrc}
        catalogApiBaseUrl={process.env.NEXT_PUBLIC_SHERPA_CATALOG_API_URL || ''}
        currentUser={currentUser}
        projectOwnerEmails={projectOwnerEmails}
        overviewSections={overviewSections}
        defaultPosition={defaultPosition}
        demoContext={demoContext}
      />
    </>
  );
}
