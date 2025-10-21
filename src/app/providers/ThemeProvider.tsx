import React, { createContext, useContext, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { DarkTheme, LightTheme, type AppTheme } from '../../theme';


const ThemeCtx = createContext<{ theme: AppTheme; setScheme: (m: 'light'|'dark'|'system') => void; scheme: 'light'|'dark'|'system'; }>({
theme: LightTheme,
setScheme: () => {},
scheme: 'system',
});


export function ThemeProvider({ children }: React.PropsWithChildren) {
const [scheme, setScheme] = useState<'light'|'dark'|'system'>('system');


const resolved: ColorSchemeName = scheme === 'system' ? Appearance.getColorScheme() : scheme;


const theme = useMemo(() => (resolved === 'dark' ? DarkTheme : LightTheme), [resolved]);


return (
<ThemeCtx.Provider value={{ theme, setScheme, scheme }}>
{children}
</ThemeCtx.Provider>
);
}


export function useAppTheme() { return useContext(ThemeCtx); }
export const useTheme = useAppTheme; // Alias for compatibility