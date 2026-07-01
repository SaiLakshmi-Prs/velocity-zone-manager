import React, { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import LineString from 'ol/geom/LineString';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Stroke, Fill, Style } from 'ol/style';
import { Draw, Modify, Snap, Select } from 'ol/interaction';
import GeoJSON from 'ol/format/GeoJSON';
import { click } from 'ol/events/condition';
import { Play, Square, Save, RotateCcw, AlertTriangle } from 'lucide-react';

interface Zone {
  id: number;
  property_id: number;
  name: string;
  type: string;
  mower_count: number;
  status: string;
  geometry: any;
  acreage: number;
  understaffed: boolean;
  conflicts: number[];
}

interface MapContainerProps {
  zones: Zone[];
  selectedZone: Zone | null;
  onZoneSelect: (zone: Zone | null) => void;
  onZoneDrawEnd: (geometry: any) => void;
  onZoneBoundaryUpdate: (zoneId: number, geometry: any) => Promise<void>;
  isDrawingMode: boolean;
  setIsDrawingMode: (draw: boolean) => void;
}

export default function MapContainer({
  zones,
  selectedZone,
  onZoneSelect,
  onZoneDrawEnd,
  onZoneBoundaryUpdate,
  isDrawingMode,
  setIsDrawingMode
}: MapContainerProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource | null>(null);
  const mowSourceRef = useRef<VectorSource | null>(null);
  const drawInteractionRef = useRef<Draw | null>(null);
  const modifyInteractionRef = useRef<Modify | null>(null);
  const selectInteractionRef = useRef<Select | null>(null);
  
  const [isModifyingMode, setIsModifyingMode] = useState(false);
  const [showMowSimulation, setShowMowSimulation] = useState(true);

  // 1. Initialize Map
  useEffect(() => {
    if (!mapElement.current) return;

    // Vector source for zones
    const vectorSource = new VectorSource();
    vectorSourceRef.current = vectorSource;

    // Vector layer for zones
    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: (feature) => {
        const type = feature.get('type') || 'rough';
        const understaffed = feature.get('understaffed') || false;
        const conflicts = feature.get('conflicts') || [];
        const isSelected = selectedZone && feature.get('id') === selectedZone.id;
        const hasConflicts = conflicts.length > 0;

        const colors: Record<string, { fill: string; stroke: string }> = {
          fairway: { fill: 'rgba(34, 197, 94, 0.15)', stroke: 'rgba(34, 197, 94, 0.8)' },
          rough: { fill: 'rgba(101, 163, 80, 0.15)', stroke: 'rgba(101, 163, 80, 0.8)' },
          perimeter: { fill: 'rgba(59, 130, 246, 0.15)', stroke: 'rgba(59, 130, 246, 0.8)' },
          exclusion: { fill: 'rgba(239, 68, 68, 0.1)', stroke: 'rgba(239, 68, 68, 0.8)' }
        };

        const currentColors = colors[type] || colors.rough;

        let fill = new Fill({ color: currentColors.fill });
        let stroke = new Stroke({
          color: currentColors.stroke,
          width: isSelected ? 4 : 2
        });

        // Highlight if conflict (neon red dashed)
        if (hasConflicts) {
          fill = new Fill({ color: 'rgba(239, 68, 68, 0.15)' });
          stroke = new Stroke({
            color: '#ef4444',
            width: isSelected ? 5 : 3.5,
            lineDash: [2, 2]
          });
        }
        // Highlight if understaffed (thick orange dashed)
        else if (understaffed) {
          fill = new Fill({ color: 'rgba(249, 115, 22, 0.1)' });
          stroke = new Stroke({
            color: '#f97316',
            width: isSelected ? 4.5 : 2.5,
            lineDash: [6, 4]
          });
        }

        return new Style({
          fill,
          stroke
        });
      }
    });

    // Vector source and layer for mowing paths simulation
    const mowSource = new VectorSource();
    mowSourceRef.current = mowSource;
    const mowLayer = new VectorLayer({
      source: mowSource,
      style: new Style({
        stroke: new Stroke({
          color: '#38bdf8', // bright sky-blue stripes
          width: 1.5,
          lineDash: [4, 4]
        })
      })
    });

    // Create Map
    const map = new Map({
      target: mapElement.current,
      layers: [
        new TileLayer({
          source: new OSM({
            url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' // dark mode cartodb tiles
          })
        }),
        vectorLayer,
        mowLayer
      ],
      view: new View({
        center: fromLonLat([78.9629, 20.5937]), // Default to India centroid
        zoom: 5
      })
    });
    mapRef.current = map;

    // Add select interaction
    const select = new Select({
      condition: click,
      style: null // Keep the same vectorLayer style (we handle selection in vectorLayer style)
    });
    select.on('select', (e) => {
      const selectedFeature = e.target.getFeatures().item(0);
      if (selectedFeature) {
        const id = selectedFeature.get('id');
        const match = zones.find(z => z.id === id);
        if (match) onZoneSelect(match);
      } else {
        onZoneSelect(null);
      }
    });
    map.addInteraction(select);
    selectInteractionRef.current = select;

    // Add Snap interaction to align points neatly
    const snap = new Snap({ source: vectorSource });
    map.addInteraction(snap);

    return () => {
      map.setTarget(undefined);
    };
  }, []);

  // 2. Render Zones on the Map & Zoom to Extent
  useEffect(() => {
    const vectorSource = vectorSourceRef.current;
    if (!vectorSource || !mapRef.current) return;

    // Clear old features
    vectorSource.clear();

    const format = new GeoJSON();

    // Map zones to OL features
    const features = zones.map(zone => {
      const feature = format.readFeature(zone.geometry, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
      });
      feature.set('id', zone.id);
      feature.set('type', zone.type);
      feature.set('understaffed', zone.understaffed);
      feature.set('conflicts', zone.conflicts);
      return feature;
    });

    vectorSource.addFeatures(features);

    // Zoom to extent
    if (features.length > 0) {
      const extent = vectorSource.getExtent();
      mapRef.current.getView().fit(extent, {
        padding: [80, 80, 80, 80],
        maxZoom: 17,
        duration: 800
      });
    } else {
      // Default view if no zones
      mapRef.current.getView().animate({
        center: fromLonLat([78.9629, 20.5937]),
        zoom: 5,
        duration: 800
      });
    }
  }, [zones]);

  // 3. Highlight Selected Zone
  useEffect(() => {
    const select = selectInteractionRef.current;
    if (!select || !mapRef.current) return;

    select.getFeatures().clear();
    
    if (selectedZone) {
      const vectorSource = vectorSourceRef.current;
      const feature = vectorSource?.getFeatures().find(f => f.get('id') === selectedZone.id);
      if (feature) {
        select.getFeatures().push(feature);
      }
    }
  }, [selectedZone]);

  // 4. Generate Mowing Simulation Lines (Back-and-forth)
  useEffect(() => {
    const mowSource = mowSourceRef.current;
    if (!mowSource) return;
    
    mowSource.clear();

    if (!showMowSimulation || zones.length === 0) return;

    // Generate paths for active non-exclusion zones
    zones.forEach(zone => {
      if (zone.status !== 'active' || zone.type === 'exclusion') return;

      const format = new GeoJSON();
      const feature = format.readFeature(zone.geometry, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
      });
      
      const geom = feature.getGeometry();
      if (geom instanceof Polygon) {
        const paths = generateMowingPaths(geom, 25); // 25 meters spacing
        mowSource.addFeatures(paths.map(p => new Feature(p)));
      }
    });
  }, [zones, showMowSimulation]);

  // 5. Draw Interactions (Create Zone)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove existing draw interaction
    if (drawInteractionRef.current) {
      map.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current = null;
    }

    if (isDrawingMode) {
      // Clear selection
      onZoneSelect(null);
      if (selectInteractionRef.current) {
        selectInteractionRef.current.getFeatures().clear();
      }

      const draw = new Draw({
        source: vectorSourceRef.current!,
        type: 'Polygon',
        style: new Style({
          fill: new Fill({ color: 'rgba(56, 189, 248, 0.2)' }),
          stroke: new Stroke({
            color: '#38bdf8',
            width: 3,
            lineDash: [4, 4]
          })
        })
      });

      draw.on('drawend', (e) => {
        const format = new GeoJSON();
        const geometry = e.feature.getGeometry();
        if (geometry) {
          const geojsonGeometry = format.writeGeometryObject(geometry, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857'
          });
          onZoneDrawEnd(geojsonGeometry);
        }
        setIsDrawingMode(false);
      });

      map.addInteraction(draw);
      drawInteractionRef.current = draw;
    }
  }, [isDrawingMode]);

  // 6. Modify Interactions (Edit Boundaries)
  const startModifying = () => {
    const map = mapRef.current;
    if (!map || !selectedZone) return;

    setIsModifyingMode(true);

    const modify = new Modify({
      features: selectInteractionRef.current!.getFeatures()
    });

    map.addInteraction(modify);
    modifyInteractionRef.current = modify;
  };

  const saveModifying = async () => {
    if (!selectedZone) return;
    const format = new GeoJSON();
    
    // Find the edited feature
    const feature = selectInteractionRef.current!.getFeatures().item(0);
    if (feature) {
      const geometry = feature.getGeometry();
      if (geometry) {
        const geojsonGeom = format.writeGeometryObject(geometry, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857'
        });
        
        await onZoneBoundaryUpdate(selectedZone.id, geojsonGeom);
      }
    }
    cancelModifying();
  };

  const cancelModifying = () => {
    const map = mapRef.current;
    if (map && modifyInteractionRef.current) {
      map.removeInteraction(modifyInteractionRef.current);
      modifyInteractionRef.current = null;
    }
    setIsModifyingMode(false);
    // Refresh features to restore boundary
    onZoneSelect(selectedZone);
  };

  // Winding back-and-forth line generator inside polygon (EPSG:3857 meters)
  const generateMowingPaths = (polygon: Polygon, spacingMeters = 25): LineString[] => {
    const extent = polygon.getExtent();
    const minX = extent[0];
    const minY = extent[1];
    const maxX = extent[2];
    const maxY = extent[3];
    
    const paths: LineString[] = [];
    let count = 0;

    for (let x = minX + spacingMeters / 2; x < maxX; x += spacingMeters) {
      const intersections: number[] = [];
      const coordinates = polygon.getCoordinates()[0]; // Outer ring

      for (let i = 0; i < coordinates.length - 1; i++) {
        const p1 = coordinates[i];
        const p2 = coordinates[i + 1];

        // Ray check
        if ((p1[0] <= x && p2[0] > x) || (p2[0] <= x && p1[0] > x)) {
          const t = (x - p1[0]) / (p2[0] - p1[0]);
          const y = p1[1] + t * (p2[1] - p1[1]);
          intersections.push(y);
        }
      }

      intersections.sort((a, b) => a - b);

      for (let i = 0; i < intersections.length - 1; i += 2) {
        const yStart = intersections[i];
        const yEnd = intersections[i + 1];
        
        const coords = count % 2 === 0 
          ? [[x, yStart], [x, yEnd]] 
          : [[x, yEnd], [x, yStart]];
        paths.push(new LineString(coords));
      }
      count++;
    }
    return paths;
  };

  return (
    <div className="flex-1 h-full flex flex-col relative bg-slate-950">
      {/* Map Element */}
      <div ref={mapElement} className="flex-1 w-full h-full" />

      {/* Map Control Bar Overlay */}
      <div className="absolute top-4 right-4 flex items-center space-x-2 z-10">
        <button
          onClick={() => setShowMowSimulation(prev => !prev)}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold backdrop-blur-md transition-all cursor-pointer ${
            showMowSimulation
              ? 'bg-blue-600/90 border-blue-500 text-white shadow-lg'
              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          {showMowSimulation ? <Square className="h-3.5 w-3.5 fill-white" /> : <Play className="h-3.5 w-3.5 fill-slate-400" />}
          <span>Mower Path Overlay</span>
        </button>

        {isDrawingMode && (
          <div className="bg-blue-600 border border-blue-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-lg animate-pulse flex items-center space-x-1.5">
            <span className="w-2 h-2 bg-white rounded-full" />
            <span>Click on map to draw polygon. Double click to finish.</span>
          </div>
        )}

        {selectedZone && !isDrawingMode && (
          <div className="flex items-center space-x-2">
            {!isModifyingMode ? (
              <button
                onClick={startModifying}
                className="flex items-center space-x-1.5 bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-900 text-blue-400 hover:text-blue-300 px-3.5 py-2 rounded-xl text-xs font-semibold backdrop-blur-md transition-all cursor-pointer shadow-lg"
              >
                <span>Edit Boundaries</span>
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={saveModifying}
                  className="flex items-center space-x-1 bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save boundary</span>
                </button>
                <button
                  onClick={cancelModifying}
                  className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Cancel</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Warnings overlay (Overlapping zones alert) */}
      {zones.some(z => z.conflicts.length > 0) && (
        <div className="absolute bottom-4 left-4 z-10 bg-red-950/90 border border-red-900/60 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-lg flex items-center space-x-2 text-red-400">
          <AlertTriangle className="h-4 w-4 text-red-400 animate-bounce" />
          <span className="text-xs font-semibold">Boundary Conflict Detected: Highlighted overlapping zones.</span>
        </div>
      )}
    </div>
  );
}
