import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import facilitiesReducer from './facilitiesSlice';
import reportsReducer from './reportsSlice';
import dashboardReducer from './dashboardSlice';
import inventoryReducer from './inventorySlice';
import feedbackReducer from './feedbackSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    facilities: facilitiesReducer,
    reports: reportsReducer,
    dashboard: dashboardReducer,
    inventory: inventoryReducer,
    feedback: feedbackReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
