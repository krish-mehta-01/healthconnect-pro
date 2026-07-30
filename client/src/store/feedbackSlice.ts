import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { FeedbackLog, SentimentTriage } from '../types';
import { getFeedback, getTriageAlerts } from '../services/api';

interface FeedbackState {
  items: FeedbackLog[];
  triageAlerts: SentimentTriage[];
  loading: boolean;
  error: string | null;
}

const initialState: FeedbackState = {
  items: [],
  triageAlerts: [],
  loading: false,
  error: null,
};

export const fetchFeedback = createAsyncThunk('feedback/fetch', async (facilityId?: string) => {
  return await getFeedback(facilityId);
});

export const fetchTriageAlerts = createAsyncThunk('feedback/fetchTriage', async () => {
  return await getTriageAlerts();
});

const feedbackSlice = createSlice({
  name: 'feedback',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchFeedback.pending, (state) => { state.loading = true; })
      .addCase(fetchFeedback.fulfilled, (state, action) => { state.loading = false; state.items = action.payload; })
      .addCase(fetchFeedback.rejected, (state, action) => { state.loading = false; state.error = action.error.message || 'Failed'; })
      .addCase(fetchTriageAlerts.fulfilled, (state, action) => { state.triageAlerts = action.payload; });
  },
});

export default feedbackSlice.reducer;
