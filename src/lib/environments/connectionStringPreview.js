function truncatePreview(value, maxLength = 96) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function maskUserInfo(userInfo = '') {
  if (!userInfo) return '****';

  const separatorIndex = userInfo.indexOf(':');
  if (separatorIndex === -1) {
    return userInfo;
  }

  const username = userInfo.slice(0, separatorIndex) || 'user';
  return `${username}:****`;
}

export function buildMaskedConnectionStringPreview(connectionString = '') {
  const trimmed = String(connectionString || '').trim();
  if (!trimmed) return '';

  const schemeMatch = trimmed.match(/^([a-z][a-z0-9+.-]*):\/\/(.*)$/i);
  if (!schemeMatch) {
    return truncatePreview(trimmed);
  }

  const [, scheme, remainder] = schemeMatch;
  const queryIndex = remainder.indexOf('?');
  const withoutQuery = queryIndex === -1 ? remainder : remainder.slice(0, queryIndex);
  const querySuffix = queryIndex === -1 ? '' : '?...';

  const pathIndex = withoutQuery.indexOf('/');
  const authority = pathIndex === -1 ? withoutQuery : withoutQuery.slice(0, pathIndex);
  const path = pathIndex === -1 ? '' : withoutQuery.slice(pathIndex);

  const atIndex = authority.lastIndexOf('@');
  const maskedAuthority = atIndex === -1
    ? authority
    : `${maskUserInfo(authority.slice(0, atIndex))}@${authority.slice(atIndex + 1)}`;

  return truncatePreview(`${scheme}://${maskedAuthority}${path}${querySuffix}`);
}

export default buildMaskedConnectionStringPreview;
