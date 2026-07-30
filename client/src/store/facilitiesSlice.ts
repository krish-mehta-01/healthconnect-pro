import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Facility } from '../types';
import { getFacilities, createFacility, updateFacility, deleteFacility } from '../services/api';

interface FacilitiesState {
  items: Facility[];
  loading: boolean;
  error: string | null;
}

const initialState: FacilitiesState = {
  items: [],
  loading: false,
  error: null,
};

export const fetchFacilities = createAsyncThunk('facilities/fetch', async () => {
  return await getFacilities();
});

export const addFacility = createAsyncThunk('facilities/add', async (data: Partial<Facility>) => {
  return await createFacility(data);
});

export const editFacility = createAsyncThunk('facilities/edit', async ({ id, data }: { id: string; data: Partial<Facility> }) => {
  return await updateFacility(id, data);
});

export const removeFacility = createAsyncThunk('facilities/remove', async (id: string) => {
  await deleteFacility(id);
  return id;
});

const facilitiesSlice = createSlice({
  name: 'facilities',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchFacilities.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchFacilities.fulfilled, (state, action) => { state.loading = false; state.items = action.payload; })
      .addCase(fetchFacilities.rejected, (state, action) => { state.loading = false; state.error = action.error.message || 'Failed'; })
      .addCase(addFacility.fulfilled, (state, action) => { state.items.push(action.payload); })
      .addCase(editFacility.fulfilled, (state, action) => {
        const idx = state.items.findIndex(f => f.ROWID === action.payload.ROWID);
        if (idx >= 0) state.items[idx] = action.payload;
      })
      .addCase(removeFacility.fulfilled, (state, action) => {
        state.items = state.items.filter(f => f.ROWID !== action.payload);
      });
  },
});

export default facilitiesSlice.reducer;
