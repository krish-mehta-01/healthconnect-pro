import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { CurrentUser } from '../types';
import { getMe, loginWithCredentials, registerNewUser } from '../services/api';

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  user: null,
  loading: false,
  error: null,
  isAuthenticated: false,
};

export const fetchCurrentUser = createAsyncThunk('auth/fetchCurrentUser', async () => {
  return await getMe();
});

export const loginUser = createAsyncThunk('auth/login', async (credentials: { email: string; password?: string }) => {
  return await loginWithCredentials(credentials);
});

export const registerUser = createAsyncThunk('auth/register', async (data: { email: string; password?: string; name: string; role: string; facilityId?: string }) => {
  return await registerNewUser(data);
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.isAuthenticated = false;
    },
    setUser(state, action) {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Authentication failed';
        state.isAuthenticated = false;
      })
      // Login
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Login failed';
        state.isAuthenticated = false;
      })
      // Register
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Registration failed';
        state.isAuthenticated = false;
      });
  },
});

export const { logout, setUser } = authSlice.actions;
export default authSlice.reducer;
