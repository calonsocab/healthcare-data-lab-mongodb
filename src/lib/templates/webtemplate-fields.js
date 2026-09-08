// src/lib/templates/webtemplate-fields.js
// Collects DV_* "data leaves" from a WebTemplate tree and returns rich metadata
export function collectTargetFields(webTemplateRoot) {
    if (!webTemplateRoot) return [];
  
    const DATA_RM = new Set([
      'DV_TEXT','DV_CODED_TEXT','DV_QUANTITY','DV_DATE_TIME','DV_DATE','DV_TIME',
      'DV_BOOLEAN','DV_COUNT','DV_URI','DV_IDENTIFIER','DV_DURATION','DV_ORDINAL',
      'DV_MULTIMEDIA','DV_PARSABLE','DV_ENCAPSULATED'
    ]);
  
    const fields = [];
  
    const walk = (node, ancestors = []) => {
      const rm = (node.rmType || '').toUpperCase();
      const name =
        node.localizedNames?.en ??
        node.name ??
        node.localizedName ??
        node.id;
  
      // Identify current SECTION and ENTRY ancestors for friendly grouping
      const sectionAnc = [...ancestors].reverse().find(a => (a.rmType || '').toUpperCase() === 'SECTION');
      const entryAnc = [...ancestors].reverse().find(a => {
        const t = (a.rmType || '').toUpperCase();
        return t === 'EVALUATION' || t === 'OBSERVATION' || t === 'INSTRUCTION' || t === 'ACTION' || t === 'ADMIN_ENTRY';
      });
      const elementAnc = [...ancestors].reverse().find(a => (a.rmType || '').toUpperCase() === 'ELEMENT');
  
      // If this is a DV_* node, it’s a true data leaf -> emit a field
      if (DATA_RM.has(rm)) {
        // Prefer the platform’s aqlPath, then fall back to stitching a path
        const aqlPath = node.aqlPath || elementAnc?.aqlPath || node.path || '';
        // Stable mapping key (works well downstream). We include /value/value for ELEMENT “value” leaves when aqlPath
        // points to the ELEMENT; if the DV_* node has its own aqlPath use that.
        const mappingKey = node.aqlPath
          ? node.aqlPath.replace(/\/value$/,'/value/value')
          : (elementAnc?.aqlPath ? `${elementAnc.aqlPath}/value/value` : '');
  
        const required = (elementAnc?.min ?? 0) > 0;
        const max = elementAnc?.max;
        const cardinality = (elementAnc
          ? `${elementAnc.min ?? 0}..${max === -1 ? '*' : (max ?? 1)}`
          : null);
  
        const input = elementAnc?.inputs?.[0] || node.inputs?.[0];
        const dataType = input?.type || rm; // keep DV_* if no Better input.type
        const allowedValues = input?.list?.map(x => x.label ?? x.value ?? x.code) || [];
  
        fields.push({
          // grouping / display
          section: sectionAnc?.localizedNames?.en ?? sectionAnc?.name ?? 'Root',
          entry: entryAnc?.localizedNames?.en ?? entryAnc?.name ?? 'Entry',
          element: elementAnc?.localizedNames?.en ?? elementAnc?.name ?? name,
          field: name,                      // leaf label (DV_* node)
          description: elementAnc?.localizedDescriptions?.en ?? elementAnc?.description ?? '',
          // mapping / type
          rmType: rm,
          dataType,
          required,
          cardinality,
          allowedValues,
          // paths
          aqlPath,
          mappingKey,                       // <- use this as the key in your mapping JSON/YAML
          // extra
          ancestors: [...ancestors, node],
          node,
        });
      }
  
      (node.children || []).forEach(child => walk(child, [...ancestors, node]));
    };
  
    walk(webTemplateRoot, []);
    return fields;
  }