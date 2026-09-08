// src/hooks/useMetadata.jsx
// Thin wrapper around MetadataProvider — kept as a hook so the many existing
// `useMetadataManager()` / `useMetadata()` call sites don't need to change.
"use client";

import { useMetadataContext } from '@/providers/MetadataProvider';

export default function useMetadata() {
  return useMetadataContext();
}
