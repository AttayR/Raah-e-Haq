/** Driver-only routes of T-521, registered in DriverStack and opened from Earnings. */
export type DriverStatementRoutes = {
  /** BE-84 weekly statement (week picker inside). */
  DriverStatements: undefined;
  /** BE-82 / BE-85 strike record. */
  DriverStrikes: undefined;
};

export const DRIVER_STATEMENTS_ROUTE = 'DriverStatements' as const;
export const DRIVER_STRIKES_ROUTE = 'DriverStrikes' as const;
