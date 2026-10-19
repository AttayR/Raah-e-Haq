import React, { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { Modal } from 'react-native';
import { useSelector } from 'react-redux';
import { ModalRoot } from '../../components/ui';
import { useQueuedModal } from '../../components/ui/modalQueue';
import type { User } from '../../services/api';
import { permissionPrimer, primerCanSkip, type PrimerKind } from './primer';
import { PermissionPrimerScreen } from './PermissionPrimerScreen';

type HostState = { apiAuth: { user: User | null } };

/**
 * Presents the permission pre-prompt (UI-R8) as a full-screen native Modal when a feature asks
 * for one (primer.ts). Mounted once inside the signed-in app (RootNavigation); while it is not
 * mounted, callers go straight to the OS prompt as before.
 *
 * Queued like the root Dialog (T-560/T-562 `useQueuedModal`): the modal turn is held until iOS
 * has finished sliding the Modal away (`onDismiss`, or the fallback timer), so a Dialog or sheet
 * asked for right after an answer never collides with it. The last page stays rendered while the
 * Modal closes.
 */
export function PermissionPrimerHost() {
  const kind = useSyncExternalStore(permissionPrimer.subscribe, permissionPrimer.current, permissionPrimer.current);
  const role = useSelector((state: HostState) => state.apiAuth.user?.role) === 'driver' ? 'driver' : 'passenger';
  const modal = useQueuedModal(kind !== null);
  const lastKind = useRef<PrimerKind | null>(null);
  if (kind) lastKind.current = kind;
  const shown = kind ?? lastKind.current;

  useEffect(() => permissionPrimer.registerHost(), []);

  const onContinue = useCallback(() => permissionPrimer.answer('continue'), []);
  const onNotNow = useCallback(() => permissionPrimer.answer('later'), []);
  // Android back: "Not now" where it is offered; the driver location page stays.
  const onRequestClose = useCallback(() => {
    const current = permissionPrimer.current();
    if (current && primerCanSkip(current)) permissionPrimer.answer('later');
  }, []);

  if (!shown) return null;
  return (
    <Modal
      visible={modal.show}
      onDismiss={modal.onDismiss}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onRequestClose}
      statusBarTranslucent
    >
      <ModalRoot>
        <PermissionPrimerScreen kind={shown} role={role} onContinue={onContinue} onNotNow={onNotNow} />
      </ModalRoot>
    </Modal>
  );
}
