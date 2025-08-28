import { createSlice, PayloadAction } from '@reduxjs/toolkit';
export type Role = 'driver' | 'passenger' | 'admin' | null;


type UserState = { role: Role; displayName?: string | null };
const initialState: UserState = { role: null, displayName: null };


const userSlice = createSlice({
name: 'user',
initialState,
reducers: {
setRole: (s, a: PayloadAction<Role>) => { s.role = a.payload; },
setDisplayName: (s, a: PayloadAction<string | null>) => { s.displayName = a.payload; },
resetUser: () => initialState,
},
});


export const { setRole, setDisplayName, resetUser } = userSlice.actions;
export default userSlice.reducer;