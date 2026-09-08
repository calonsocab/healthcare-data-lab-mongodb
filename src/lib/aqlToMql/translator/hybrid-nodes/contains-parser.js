// lib/aqlToMql/translator/hybrid-nodes/contains-parser.js

/**
 * Parse the CONTAINS clauses of an AQL query.
 */
 export function parseContainsClauses(ast) {
  const containsInfo = {
    entries: [],
    entriesByAlias: {},
    containmentTree: {},
    hasMultipleArchetypes: false
  };
  
  if (!ast || !ast.contains) {
    return containsInfo;
  }
  
  try {
    processContains(ast.contains, null, containsInfo);
    containsInfo.hasMultipleArchetypes = containsInfo.entries.length > 1;
    containsInfo.entries.forEach(entry => {
      if (entry.alias) {
        containsInfo.entriesByAlias[entry.alias] = entry;
      }
    });
    buildContainmentTree(containsInfo);
  } catch (error) {
    console.error("[CONTAINS Parser] Error parsing CONTAINS clauses:", error);
  }
  
  return containsInfo;
}

function processContains(contains, parentAlias, containsInfo) {
  if (!contains) return;
  if (contains.operator === 'AND' && contains.children) {
    Object.values(contains.children).forEach(child => {
      processContains(child, parentAlias, containsInfo);
    });
    return;
  }
  if (contains.rmType) {
    let archetypeId = null;
    if (contains.predicate && contains.predicate.path === 'archetype_node_id') {
      archetypeId = contains.predicate.value;
    }
    const entry = {
      alias: contains.alias || '',
      rmType: contains.rmType,
      archetypeId,
      parentAlias,
      path: contains.path || '',
      dataPaths: [],
      constraints: []
    };
    containsInfo.entries.push(entry);
    if (contains.contains) {
      processContains(contains.contains, entry.alias, containsInfo);
    }
  } else if (contains.operator === 'OR' && contains.children) {
    Object.values(contains.children).forEach(child => {
      processContains(child, parentAlias, containsInfo);
    });
  }
}

function buildContainmentTree(containsInfo) {
  const entriesByParent = {};
  const topLevelEntries = [];
  containsInfo.entries.forEach(entry => {
    if (!entry.parentAlias) {
      topLevelEntries.push(entry);
    } else {
      if (!entriesByParent[entry.parentAlias]) {
        entriesByParent[entry.parentAlias] = [];
      }
      entriesByParent[entry.parentAlias].push(entry);
    }
  });
  function buildSubtree(entries) {
    const tree = {};
    entries.forEach(entry => {
      tree[entry.alias] = {
        rmType: entry.rmType,
        archetypeId: entry.archetypeId,
        children: {}
      };
      const children = entriesByParent[entry.alias] || [];
      if (children.length > 0) {
        tree[entry.alias].children = buildSubtree(children);
      }
    });
    return tree;
  }
  containsInfo.containmentTree = buildSubtree(topLevelEntries);
}

export function getContainmentPath(alias, containsInfo) {
  const path = [];
  function findPath(currentAlias) {
    path.unshift(currentAlias);
    const entry = containsInfo.entriesByAlias[currentAlias];
    if (entry && entry.parentAlias) {
      findPath(entry.parentAlias);
    }
  }
  findPath(alias);
  return path;
}

export function findEntryByArchetypeId(archetypeId, containsInfo) {
  for (const entry of containsInfo.entries) {
    if (entry.archetypeId === archetypeId) {
      return entry;
    }
  }
  return null;
}

export default parseContainsClauses;