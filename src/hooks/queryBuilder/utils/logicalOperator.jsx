// src/hooks/queryBuilder/logicalOperator.jsx
"use client";

/**
 * Utility function to handle logical operators with proper parentheses
 * @param {Object[]} nodes - Array of containment nodes
 * @param {Function} renderNode - Function to render a node as string
 * @returns {String} - Formatted string with proper logical operators
 */
export const formatNodesWithLogicalOperators = (nodes, renderNode) => {
  if (!nodes || nodes.length === 0) return '';
  
  // First, determine if we need parentheses (if we have mixed AND/OR)
  const operators = nodes
    .filter((_, index) => index > 0)
    .map(node => node.logicalOperator || 'AND');
  
  // Check if we have mixed operators (AND/OR) that would require parentheses
  const needsParentheses = operators.includes('OR') && operators.includes('AND');
  
  // Special case - if we have only ORs, we definitely need parentheses 
  // to maintain proper AQL precedence
  const hasOrOperator = operators.includes('OR');
  
  let result = '';
  
  // Open parentheses if needed
  if (needsParentheses || hasOrOperator) {
    result += '(';
  }
  
  // Format all nodes with their logical operators
  result += nodes.map((node, index) => {
    const nodeText = renderNode(node);
    
    if (index === 0) {
      return nodeText;
    } else {
      const logicalOp = node.logicalOperator || 'AND';
      return `${logicalOp} ${nodeText}`;
    }
  }).join(' ');
  
  // Close parentheses if needed
  if (needsParentheses || hasOrOperator) {
    result += ')';
  }
  
  return result;
};

/**
 * Function to determine if two nodes are at the same hierarchy level
 * in the openEHR reference model
 * @param {String} type1 - First node's rmType 
 * @param {String} type2 - Second node's rmType
 * @returns {Boolean} - True if nodes are at the same level
 */
export const areSameHierarchyLevel = (type1, type2) => {
  if (!type1 || !type2) return false;
  
  const t1 = type1.toUpperCase();
  const t2 = type2.toUpperCase();
  
  // Check if types are exactly the same
  if (t1 === t2) return true;
  
  // Define groups of types that are considered to be at the same hierarchy level
  const HIERARCHY_LEVELS = [
    ["EHR"],
    ["COMPOSITION"],
    ["SECTION"],
    ["OBSERVATION", "EVALUATION", "INSTRUCTION", "ACTION", "ADMIN_ENTRY"], // Entry types
    ["CLUSTER", "ELEMENT"]
  ];
  
  // Check if both types are in the same hierarchy group
  for (const level of HIERARCHY_LEVELS) {
    if (level.includes(t1) && level.includes(t2)) return true;
  }
  
  return false;
};

/**
 * Groups sibling nodes that should be connected by logical operators
 * @param {Object[]} nodes - Array of nodes at the same level
 * @returns {Object[]} - Array of node groups by hierarchy level
 */
export const groupNodesByHierarchyLevel = (nodes) => {
  const groups = [];
  let currentGroup = [];
  
  nodes.forEach((node, index) => {
    if (index === 0) {
      // First node starts a new group
      currentGroup.push(node);
    } else {
      const prevNode = nodes[index - 1];
      
      if (areSameHierarchyLevel(node.node.rmType, prevNode.node.rmType)) {
        // If same level, add to current group
        currentGroup.push(node);
      } else {
        // Different level, finish previous group and start new one
        if (currentGroup.length > 0) {
          groups.push([...currentGroup]);
        }
        currentGroup = [node];
      }
    }
  });
  
  // Add the last group if not empty
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  
  return groups;
};

/**
 * Updates the logical operator of a node
 * @param {Function} setQueryState - State setter function
 * @returns {Function} - Callback function to update logical operator
 */
export const createUpdateLogicalOperator = (setQueryState) => {
  return (index, operator) => {
    setQueryState((prev) => ({
      ...prev,
      contains: prev.contains.map((item, i) =>
        i === index ? { ...item, logicalOperator: operator } : item
      )
    }));
  };
};

/**
 * Builds a CONTAINS clause with proper nesting and logical operators
 * @param {Object} queryState - Current query state
 * @param {Number} parentIndex - Parent node index to build from
 * @param {Number} indent - Indentation level 
 * @returns {String} - Formatted CONTAINS clause
 */
export const buildContainsClause = (queryState, parentIndex, indent = 1) => {
  // Find children that share this parent
  const children = queryState.contains.filter(item =>
    item.parentIndex === parentIndex
  );

  if (children.length === 0) return '';

  // Group children by their hierarchy level for logical operators
  const levelGroups = groupNodesByHierarchyLevel(children);
  
  let result = '';
  const indentation = '    '.repeat(indent);

  // Process each group separately
  levelGroups.forEach((group, groupIndex) => {
    // Start with CONTAINS for the first group
    if (groupIndex === 0) {
      result += `\n${indentation}CONTAINS `;
    } else {
      result += `\n${indentation}AND `; // Groups at different levels are always connected by AND
    }
    
    // If this group has multiple nodes, check if we need parentheses
    if (group.length > 1) {
      const hasOrOperator = group.some((node, idx) => 
        idx > 0 && node.logicalOperator === 'OR'
      );
      
      if (hasOrOperator) {
        result += '(';
      }
      
      // Process nodes in this group
      group.forEach((node, idx) => {
        const alias = node.alias || '_'; // Use underscore as placeholder if no alias
        const nodeId = node.node.nodeId || '';
        
        // Add logical operator for nodes after the first one
        if (idx > 0) {
          const logicalOp = node.logicalOperator || 'AND';
          result += ` ${logicalOp} `;
        }
        
        // Add the node definition
        result += `${node.node.rmType} ${alias}`;
        if (nodeId) {
          result += `[${nodeId}]`;
        }
        
        // Add children for this node
        const nodeIndex = queryState.contains.indexOf(node);
        const childClauses = buildContainsClause(queryState, nodeIndex, indent + 1);
        if (childClauses) {
          result += childClauses;
        }
      });
      
      // Close parentheses if needed
      if (hasOrOperator) {
        result += ')';
      }
    } else {
      // Single node in this group
      const node = group[0];
      const alias = node.alias || '_';
      const nodeId = node.node.nodeId || '';
      
      // Add the node definition
      result += `${node.node.rmType} ${alias}`;
      if (nodeId) {
        result += `[${nodeId}]`;
      }
      
      // Add children for this node
      const nodeIndex = queryState.contains.indexOf(node);
      const childClauses = buildContainsClause(queryState, nodeIndex, indent + 1);
      if (childClauses) {
        result += childClauses;
      }
    }
  });

  return result;
};