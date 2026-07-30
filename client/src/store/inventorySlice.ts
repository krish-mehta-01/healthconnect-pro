import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { InventoryMaster, FacilityInventory, SupplyRequest } from '../types';
import { getInventoryMaster, getFacilityInventory, getSupplyRequests } from '../services/api';

interface InventoryState {
  masterItems: InventoryMaster[];
  facilityStock: FacilityInventory[];
  supplyRequests: SupplyRequest[];
  loading: boolean;
  error: string | null;
}

const initialState: InventoryState = {
  masterItems: [],
  facilityStock: [],
  supplyRequests: [],
  loading: false,
  error: null,
};

export const fetchInventoryMaster = createAsyncThunk('inventory/fetchMaster', async () => {
  return await getInventoryMaster();
});

export const fetchFacilityInventory = createAsyncThunk('inventory/fetchFacility', async (facilityId?: string) => {
  return await getFacilityInventory(facilityId);
});

export const fetchSupplyRequests = createAsyncThunk('inventory/fetchRequests', async (facilityId?: string) => {
  return await getSupplyRequests(facilityId);
});

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchInventoryMaster.pending, (state) => { state.loading = true; })
      .addCase(fetchInventoryMaster.fulfilled, (state, action) => { state.loading = false; state.masterItems = action.payload; })
      .addCase(fetchInventoryMaster.rejected, (state, action) => { state.loading = false; state.error = action.error.message || 'Failed'; })
      .addCase(fetchFacilityInventory.fulfilled, (state, action) => { state.facilityStock = action.payload; })
      .addCase(fetchSupplyRequests.fulfilled, (state, action) => { state.supplyRequests = action.payload; });
  },
});

export default inventorySlice.reducer;
