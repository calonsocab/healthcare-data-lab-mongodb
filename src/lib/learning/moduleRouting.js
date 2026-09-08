import learningModulesConfig from '@/config/learningModules.json';

const modules = learningModulesConfig.modules ?? [];

const viewToModuleMap = new Map();

for (const module of modules) {
  const routes = Array.isArray(module.routes) ? module.routes : [];
  for (const route of routes) {
    if (!viewToModuleMap.has(route)) {
      viewToModuleMap.set(route, module.id);
    }
  }
}

export function getLearningModuleIdForView(viewId) {
  if (!viewId) return null;
  return viewToModuleMap.get(viewId) || null;
}

export function getLearningModuleById(moduleId) {
  if (!moduleId) return null;
  return modules.find((m) => m.id === moduleId) || null;
}
