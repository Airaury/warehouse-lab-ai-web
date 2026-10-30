export const roleCanAccess = (role, allowed) =>
  allowed.includes(role) ||
  (role === "CHAIRMAN" && allowed.includes("MANAGER"));

export const canCreateAccount = (actorRole, targetRole) =>
  (actorRole === "CHAIRMAN" &&
    ["MANAGER", "DEPUTY", "OPERATOR", "VIEWER"].includes(targetRole)) ||
  (actorRole === "MANAGER" &&
    ["DEPUTY", "OPERATOR", "VIEWER"].includes(targetRole));

export const canManageAccount = (actorRole, targetRole) =>
  (actorRole === "CHAIRMAN" && targetRole !== "CHAIRMAN") ||
  (actorRole === "MANAGER" &&
    ["DEPUTY", "OPERATOR", "VIEWER"].includes(targetRole));
