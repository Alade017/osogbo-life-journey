// src/store/mapSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "./store"; // Adjust import path if your store file is elsewhere

/**
 * Point of Interest (POI) definition for the Osogbo map.
 */
export interface POI {
  id: string;
  name: string;
  category: string;
  /**
   * 3D world position: [x, y, z]
   */
  position: [number, number, number];
  description: string;
}

interface MapState {
  selectedPoi: POI | null;
  hoveredPoiId: string | null;
}

const initialState: MapState = {
  selectedPoi: null,
  hoveredPoiId: null,
};

export const mapSlice = createSlice({
  name: "map",
  initialState,
  reducers: {
    setSelectedPoi(state, action: PayloadAction<POI | null>) {
      state.selectedPoi = action.payload;
    },
    setHoveredPoiId(state, action: PayloadAction<string | null>) {
      state.hoveredPoiId = action.payload;
    },
  },
});

export const { setSelectedPoi, setHoveredPoiId } = mapSlice.actions;

// Selectors for convenient access
export const selectSelectedPoi = (state: RootState) => state.map.selectedPoi;
export const selectHoveredPoiId = (state: RootState) => state.map.hoveredPoiId;

export default mapSlice.reducer;
