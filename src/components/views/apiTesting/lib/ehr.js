export function getEhrId(ehr) {
  if (ehr?.ehr_id?.value) return ehr.ehr_id.value;
  if (typeof ehr?.ehr_id === 'string') return ehr.ehr_id;
  if (ehr?._id?.value) return ehr._id.value;
  return ehr?.id || null;
}

export function getTimeCreated(ehr) {
  const timeValue = ehr?.time_created?.value || ehr?.time_created;
  if (!timeValue) return null;
  const date = new Date(timeValue);
  return isNaN(date.getTime()) ? null : date;
}

export function getSubjectId(ehr) {
  return ehr?.ehr_status?.subject?.external_ref?.id?.value ||
         ehr?.ehr_status?.subject?.id?.value ||
         ehr?.subject?.id || null;
}

export function getSubjectNamespace(ehr) {
  return ehr?.ehr_status?.subject?.external_ref?.namespace ||
         ehr?.ehr_status?.subject?.namespace ||
         ehr?.subject?.namespace || null;
}
