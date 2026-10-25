"use client";
import { useEffect, useMemo } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Board } from "@/lib/types";

const pin = (n: number) =>
  L.divIcon({ className: "", html: `<div class="stop-pin">${n}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] });

function Fit({ points, maxZoom }: { points: [number, number][]; maxZoom: number }) {
  const map = useMap();
  const key = JSON.stringify(points);
  useEffect(() => {
    if (points.length === 1) map.flyTo(points[0], Math.min(maxZoom, 11), { duration: 0.8 });
    else if (points.length) map.flyToBounds(L.latLngBounds(points).pad(0.2), { duration: 0.8, maxZoom });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, maxZoom, map]);
  return null;
}

export default function TourMap({ board, focusCity }: { board: Board; focusCity?: string }) {
  const stops = board.stops;
  const route = stops.map((s) => [s.lat, s.lng] as [number, number]);
  const marketPts = board.markets.map((m) => [m.lat, m.lng] as [number, number]);
  const scout = focusCity ? board.scouts[focusCity] : undefined;
  const focusStop = stops.find((s) => s.city === focusCity) ?? board.markets.find((m) => m.city === focusCity);
  const focusPts: [number, number][] = scout
    ? [
        ...scout.hotspots.slice(0, 6).map((h) => [h.lat, h.lng] as [number, number]),
        ...scout.venues.filter((v) => v.lat !== undefined && v.lng !== undefined).map((v) => [v.lat!, v.lng!] as [number, number]),
      ]
    : [];
  const maxAff = useMemo(() => Math.max(0.0001, ...board.markets.map((m) => m.affinity)), [board.markets]);

  return (
    <MapContainer
      center={[39, -96]}
      zoom={3}
      scrollWheelZoom={false}
      className="h-full w-full"
      worldCopyJump
      attributionControl
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
        maxZoom={16}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />
      <Fit
        points={
          focusPts.length
            ? focusPts
            : focusStop
              ? [[focusStop.lat, focusStop.lng]]
              : route.length
                ? route
                : marketPts
        }
        maxZoom={focusPts.length || focusStop ? 13 : 6}
      />

      {board.markets.map((m) => (
        <CircleMarker
          key={m.city}
          center={[m.lat, m.lng]}
          radius={4 + 14 * (m.affinity / maxAff)}
          pathOptions={{ color: "#ff5c8a", weight: 1, fillColor: "#ff5c8a", fillOpacity: 0.12 + 0.35 * (m.affinity / maxAff) }}
        >
          <Tooltip>
            {m.city}: fan affinity {(m.affinity * 100).toFixed(0)}
          </Tooltip>
        </CircleMarker>
      ))}

      {route.length > 1 && <Polyline positions={route} pathOptions={{ color: "#ffb547", weight: 3, dashArray: "6 8" }} />}

      {stops.map((s) => (
        <Marker key={s.city} position={[s.lat, s.lng]} icon={pin(s.order)}>
          <Popup>
            <strong>
              {s.order}. {s.city}
            </strong>
            <br />
            {s.date}
            {s.venue && (
              <>
                <br />
                {s.venue.name}
              </>
            )}
          </Popup>
        </Marker>
      ))}

      {scout?.hotspots.map((h, i) => {
        const style = { color: "#ffb547", weight: 1, fillColor: "#ffb547", fillOpacity: 0.08 + 0.4 * h.affinity };
        const tip = (
          <Tooltip sticky>
            {h.name ?? "Fan hotspot"} · fan affinity {(h.affinity * 100).toFixed(0)}
          </Tooltip>
        );
        return h.polygon && h.polygon.length > 2 ? (
          <Polygon key={`h${i}`} positions={h.polygon} pathOptions={style}>
            {tip}
          </Polygon>
        ) : (
          <CircleMarker key={`h${i}`} center={[h.lat, h.lng]} radius={8 + 10 * h.affinity} pathOptions={{ ...style, weight: 0 }}>
            {tip}
          </CircleMarker>
        );
      })}
      {[...(scout?.venues ?? []), ...(scout?.hangouts ?? [])]
        .filter((v) => v.lat !== undefined && v.lng !== undefined)
        .map((v) => {
          const isVenue = scout!.venues.includes(v);
          return (
            <CircleMarker
              key={v.id}
              center={[v.lat!, v.lng!]}
              radius={5}
              pathOptions={{ color: isVenue ? "#3ad6c5" : "#ececf3", weight: 2, fillOpacity: 0.9, fillColor: isVenue ? "#3ad6c5" : "#13131b" }}
            >
              <Tooltip>
                {isVenue ? "Venue" : "Local spot"}: {v.name}
              </Tooltip>
            </CircleMarker>
          );
        })}
    </MapContainer>
  );
}
