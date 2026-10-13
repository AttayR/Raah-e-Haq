/** Static copy for the driver online/offline toggle (T-401). Server refusals bring their own text. */
export const DRIVER_STATUS_COPY = {
  onRideToggleBlocked: 'You cannot go offline during a ride.',
  loadFailed: 'Could not check your online status',
  updateFailed: 'Could not change your online status. Please try again.',
} as const;
