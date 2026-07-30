import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { DashboardStats } from '../types';
import { getDashboard } from '../services/api';

interface DashboardState {
  stats: DashboardStats | null;
  loading: boolean;
  error: string | null;
}

const initialState: DashboardState = {
  stats: null,
  loading: false,
  error: null,
};

export const fetchDashboard = createAsyncThunk('dashboard/fetch', async () => {
  return await getDashboard();
});

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboard.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchDashboard.fulfilled, (state, action) => { state.loading = false; state.stats = action.payload; })
      .addCase(fetchDashboard.rejected, (state, action) => { state.loading = false; state.error = action.error.message || 'Failed'; });
  },
});

export default dashboardSlice.reducer;
