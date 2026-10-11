import { createContext, useContext } from 'react';
import type { View } from 'react-native';

/**
 * Lets a registration step mark where a field's error is shown (T-202), so the screen can
 * scroll to the first field the server refused. A step puts `ref={anchor('email')}` on the
 * field's error block; outside RegistrationScreen the refs do nothing.
 */
export type FieldAnchor = (field: string) => (node: View | null) => void;

const noopRef = () => undefined;

export const FieldAnchorContext = createContext<FieldAnchor>(() => noopRef);

export const useFieldAnchor = (): FieldAnchor => useContext(FieldAnchorContext);
