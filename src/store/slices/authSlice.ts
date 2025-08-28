import { createSlice, PayloadAction } from '@reduxjs/toolkit';


export type AuthState = {
uid: string | null;
email: string | null;
status: 'idle' | 'loading' | 'authenticated' | 'error';
error?: string | null;
};


const initialState: AuthState = { uid: null, email: null, status: 'idle', error: null };


const authSlice = createSlice({
name: 'auth',
initialState,
reducers: {
setAuthLoading: (s) => { s.status = 'loading'; s.error = null; },
setAuthenticated: (s, a: PayloadAction<{ uid: string; email: string | null }>) => {
s.uid = a.payload.uid; s.email = a.payload.email ?? null; s.status = 'authenticated';
},
setSignedOut: (s) => { s.uid = null; s.email = null; s.status = 'idle'; },
setAuthError: (s, a: PayloadAction<string>) => { s.error = a.payload; s.status = 'error'; },
},
});


export const { setAuthLoading, setAuthenticated, setSignedOut, setAuthError } = authSlice.actions;
export default authSlice.reducer;