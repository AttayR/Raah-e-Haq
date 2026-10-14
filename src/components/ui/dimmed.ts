import { createContext } from 'react';

/**
 * True inside a container that already draws itself at the disabled opacity (a disabled
 * ListItem). Controls inside it skip their own disabled opacity so the two do not multiply
 * (0.4 × 0.4 would make a switch track all but invisible).
 */
export const DimmedContext = createContext(false);
