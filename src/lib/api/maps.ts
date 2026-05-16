import { apiRequest } from "@/lib/api/http";

export interface PlacePrediction {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
}

export interface PlaceDetails {
  placeId: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string | null;
  primaryText: string;
  secondaryText: string;
  addressComponents: Array<{ longName: string; shortName: string; types: string[] }> | null;
}

export async function searchPlaces(
  input: string,
  sessionToken?: string,
): Promise<{ predictions: PlacePrediction[] }> {
  const params = new URLSearchParams({ input });
  if (sessionToken) params.set("sessionToken", sessionToken);
  return apiRequest<{ predictions: PlacePrediction[] }>(
    `/api/maps/places?${params.toString()}`,
    { method: "GET", cache: "no-store" },
  );
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  return apiRequest<PlaceDetails>(
    `/api/maps/place-details?placeId=${encodeURIComponent(placeId)}`,
    { method: "GET", cache: "no-store" },
  );
}
