/** View state for the optional map preview. Authoritative travel uses map-api. */
export interface POI {
  id: string;
  name: string;
  category: string;
  position: [number, number, number];
  description: string;
}
export interface MapState {
  selectedPoi: POI | null;
  hoveredPoiId: string | null;
}
export const initialMapState: MapState = { selectedPoi: null, hoveredPoiId: null };
export const setSelectedPoi = (payload: POI | null) => ({ type: "map/select" as const, payload });
export const setHoveredPoiId = (payload: string | null) => ({
  type: "map/hover" as const,
  payload,
});
type MapAction = ReturnType<typeof setSelectedPoi> | ReturnType<typeof setHoveredPoiId>;
export default function mapReducer(state: MapState, action: MapAction): MapState {
  switch (action.type) {
    case "map/select":
      return { ...state, selectedPoi: action.payload };
    case "map/hover":
      return { ...state, hoveredPoiId: action.payload };
  }
}
