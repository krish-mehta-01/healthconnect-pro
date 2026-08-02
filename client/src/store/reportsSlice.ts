import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { HealthReport } from '../types';
import { getReports, getReport, submitNewReport, submitReportForApproval, approveReport, endorseReport as endorseReportApi } from '../services/api';

interface ReportsState {
  items: HealthReport[];
  current: HealthReport | null;
  loading: boolean;
  error: string | null;
}

const initialState: ReportsState = {
  items: [],
  current: null,
  loading: false,
  error: null,
};

export const fetchReports = createAsyncThunk('reports/fetch',
  async (params?: { facility_id?: string; status?: string; cycle_id?: string }) => {
    return await getReports(params);
  }
);

export const fetchReport = createAsyncThunk('reports/fetchOne', async (id: string) => {
  return await getReport(id);
});

export const createReport = createAsyncThunk('reports/create',
  async (data: { facility_id: string; cycle_id?: string; indicators: { indicator_id: string; value: string; notes?: string }[] }) => {
    return await submitNewReport(data);
  }
);

export const submitReport = createAsyncThunk('reports/submit', async (id: string) => {
  return await submitReportForApproval(id);
});

export const reviewReport = createAsyncThunk('reports/review',
  async (data: { report_id: string; status: string; notes?: string }) => {
    return await approveReport(data);
  }
);

export const endorseReport = createAsyncThunk('reports/endorse',
  async (data: { report_id: string; comments?: string }) => {
    return await endorseReportApi(data.report_id, data.comments);
  }
);

const reportsSlice = createSlice({
  name: 'reports',
  initialState,
  reducers: {
    clearCurrent(state) { state.current = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReports.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchReports.fulfilled, (state, action) => { state.loading = false; state.items = action.payload; })
      .addCase(fetchReports.rejected, (state, action) => { state.loading = false; state.error = action.error.message || 'Failed'; })
      .addCase(fetchReport.pending, (state) => { state.loading = true; })
      .addCase(fetchReport.fulfilled, (state, action) => { state.loading = false; state.current = action.payload; })
      .addCase(fetchReport.rejected, (state, action) => { state.loading = false; state.error = action.error.message || 'Failed'; })
      .addCase(createReport.fulfilled, (state, action) => { state.items.unshift(action.payload); })
      .addCase(submitReport.fulfilled, (state, action) => {
        const idx = state.items.findIndex(r => r.ROWID === action.payload.ROWID);
        if (idx >= 0) state.items[idx] = action.payload;
        if (state.current?.ROWID === action.payload.ROWID) state.current = { ...state.current, ...action.payload };
      })
      .addCase(reviewReport.fulfilled, (state, action) => {
        const idx = state.items.findIndex(r => r.ROWID === action.payload.ROWID);
        if (idx >= 0) state.items[idx] = action.payload;
        if (state.current?.ROWID === action.payload.ROWID) state.current = { ...state.current, ...action.payload };
      })
      .addCase(endorseReport.fulfilled, (state, action) => {
        const idx = state.items.findIndex(r => r.ROWID === action.payload.ROWID);
        if (idx >= 0) state.items[idx] = action.payload;
        if (state.current?.ROWID === action.payload.ROWID) state.current = { ...state.current, ...action.payload };
      });
  },
});

export const { clearCurrent } = reportsSlice.actions;
export default reportsSlice.reducer;
