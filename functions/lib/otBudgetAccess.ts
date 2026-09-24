// The whole OT-budget module (read AND write) is limited to HR and system admins —
// per HR, no other role may see any of its data. Primary role only, same as the Home menu.
export const canAccessOtBudget = (role: string) => ["hr", "deputyHR", "admin"].includes(role);
