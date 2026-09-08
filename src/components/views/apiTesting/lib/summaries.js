export function buildBatchSummary({ itemLabel, successCount, failureCount, failures = [] }) {
  const totalCount = successCount + failureCount;
  const pluralLabel = totalCount === 1 ? itemLabel : `${itemLabel}s`;
  const kind =
    failureCount === 0 ? 'success' :
    successCount > 0 ? 'warning' :
    'error';

  const title =
    failureCount === 0
      ? `${successCount} ${pluralLabel} processed successfully`
      : successCount > 0
        ? `${successCount} ${pluralLabel} succeeded, ${failureCount} failed`
        : `Unable to process ${failureCount} ${pluralLabel}`;

  const message =
    failureCount === 0
      ? ''
      : successCount > 0
        ? 'Only failed items remain queued so you can retry them.'
        : 'Review the failed items below and retry when ready.';

  const lines = failures.slice(0, 5).map(({ label, message: failureMessage }) => (
    `${label}: ${failureMessage}`
  ));

  if (failures.length > 5) {
    lines.push(`${failures.length - 5} more ${pluralLabel.toLowerCase()} failed.`);
  }

  return { kind, title, message, lines };
}

export function buildImportSummary({ itemLabel, successCount, alreadyLoadedCount = 0, failures = [] }) {
  const failureCount = failures.length;
  const totalCount = successCount + alreadyLoadedCount + failureCount;
  const pluralLabel = totalCount === 1 ? itemLabel : `${itemLabel}s`;

  const kind =
    failureCount > 0
      ? (successCount > 0 || alreadyLoadedCount > 0 ? 'warning' : 'error')
      : (alreadyLoadedCount > 0 ? 'info' : 'success');

  const title =
    failureCount === 0
      ? successCount > 0
        ? `Loaded ${successCount} ${pluralLabel} into the sandbox`
        : `${alreadyLoadedCount} ${pluralLabel} already available in the sandbox`
      : `Processed ${totalCount} ${pluralLabel} with ${failureCount} issue${failureCount === 1 ? '' : 's'}`;

  const messageParts = [];
  if (successCount > 0) messageParts.push(`${successCount} loaded into the runtime templates collection.`);
  if (alreadyLoadedCount > 0) messageParts.push(`${alreadyLoadedCount} already existed in the sandbox.`);
  if (failureCount > 0) messageParts.push(`${failureCount} could not be loaded.`);

  const lines = failures.slice(0, 5).map(({ label, message: failureMessage }) => (
    `${label}: ${failureMessage}`
  ));

  if (failures.length > 5) {
    lines.push(`${failures.length - 5} more ${pluralLabel.toLowerCase()} had issues.`);
  }

  return {
    kind,
    title,
    message: messageParts.join(' '),
    lines,
  };
}

export function buildCompositionDeleteSummary(successCount, failures = []) {
  const failureCount = failures.length;
  if (failureCount === 0) {
    return {
      kind: 'success',
      title: `Deleted ${successCount} composition${successCount === 1 ? '' : 's'}`,
      message: '',
      lines: [],
    };
  }

  const lines = failures.slice(0, 5).map(({ label, message }) => `${label}: ${message}`);
  if (failures.length > 5) {
    lines.push(`${failures.length - 5} more compositions failed.`);
  }

  if (successCount > 0) {
    return {
      kind: 'warning',
      title: `Deleted ${successCount} composition${successCount === 1 ? '' : 's'}, ${failureCount} failed`,
      message: 'Review the failed deletions below and retry if needed.',
      lines,
    };
  }

  return {
    kind: 'error',
    title: `Unable to delete ${failureCount} composition${failureCount === 1 ? '' : 's'}`,
    message: 'Review the failed deletions below and retry when ready.',
    lines,
  };
}
