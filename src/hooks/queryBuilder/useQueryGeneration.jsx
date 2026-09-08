//hooks/queryBuilder/useQueryGeneration.jsx
"use client";

import { buildFromClause } from "./emitters/fromClause";
import { buildWhereClause } from "./emitters/whereClause";
import { buildNodePath } from "./utils/pathUtils";

export const generateQueryString = (queryState, activeTemplates, useDistinct = false) => {
  if (!activeTemplates?.length) return "";

  const parts = [];

  // SELECT
  if (queryState.select?.length) {
    const head = `SELECT${useDistinct ? " DISTINCT" : ""}`;
    const items = queryState.select.map((item) => {
      if (item.type === "function") {
        const call = item.argument
          ? `${item.functionType}(${item.argument})`
          : `${item.functionType}()`;
        return item.alias ? `${call} AS ${item.alias}` : call;
      }
      if (item.type === "variable") {
        return item.alias ? `${item.variable} AS ${item.alias}` : item.variable;
      }
      if (item.type === "literal") {
        return item.alias ? `${item.value} AS ${item.alias}` : item.value;
      }
      const path = buildNodePath(item.template, item.node, queryState.contains);
      return item.alias ? `${path} AS ${item.alias}` : path;
    });
    parts.push(`${head}\n    ${items.join(",\n    ")}`);
  } else {
    parts.push("SELECT *");
  }

  // FROM / CONTAINS
  const fromText = buildFromClause(queryState);
  parts.push(fromText || `FROM ${activeTemplates[0]}`);

  // WHERE
  if (queryState.where?.length) {
    const w = buildWhereClause(queryState);
    if (w.length) parts.push(`WHERE ${w.join(" AND\n    ")}`);
  }

  // ORDER BY
  if (queryState.orderBy?.length) {
    const items = queryState.orderBy.map((item) => {
      const p = buildNodePath(item.template, item.node, queryState.contains);
      return `${p} ${item.direction}`;
    });
    parts.push(`ORDER BY ${items.join(",\n    ")}`);
  }

  if (queryState.limit) parts.push(`LIMIT ${queryState.limit}`);
  if (queryState.offset) parts.push(`OFFSET ${queryState.offset}`);

  return parts.join("\n");
};

