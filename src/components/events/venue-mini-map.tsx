"use client";

import { useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface VenueMiniMapProps {
  lat: number;
  lng: number;
  venueName: string;
}

function createMiniMarkerIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [26, 34],
    iconAnchor: [13, 34],
    popupAnchor: [0, -32],
    html: `
      <svg width="26" height="34" viewBox="0 0 26 34" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13 0C5.82 0 0 5.82 0 13c0 9.75 13 20.5 13 20.5S26 22.75 26 13C26 5.82 20.18 0 13 0z" fill="#22D3EE" fill-opacity="0.88" stroke="#22D3EE" stroke-width="1.5"/>
        <circle cx="13" cy="12" r="5" fill="white" fill-opacity="0.95"/>
      </svg>
    `,
  });
}

export function VenueMiniMap({ lat, lng, venueName }: VenueMiniMapProps) {
  const markerIcon = useMemo(() => createMiniMarkerIcon(), []);

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08]">
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        style={{ height: "150px", width: "100%" }}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        zoomControl={false}
        attributionControl
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Marker position={[lat, lng]} icon={markerIcon}>
          <Popup>{venueName}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
