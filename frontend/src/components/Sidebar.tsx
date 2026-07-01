import React, { useRef, useState } from 'react';
import { 
  ShieldAlert, 
  MapPin, 
  Layers, 
  Compass, 
  Upload, 
  Download, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2,
  FileCode,
  X
} from 'lucide-react';
import api from '../utils/api';

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

interface Summary {
  total_zones: number;
  total_acreage: number;
  total_mowers_assigned: number;
  understaffed_count: number;
}

interface SidebarProps {
  property: { id: number; name: string; type: string; total_acreage: number; notes: string };
  zones: Zone[];
  summary: Summary;
  selectedZone: Zone | null;
  onZoneSelect: (zone: Zone | null) => void;
  onAddZoneClick: () => void;
  onZoneDelete: (zoneId: number) => Promise<void>;
  onZonesImported: (zones: Zone[]) => void;
  onBackToProperties: () => void;
}

export default function Sidebar({
  property,
  zones,
  summary,
  selectedZone,
  onZoneSelect,
  onAddZoneClick,
  onZoneDelete,
  onZonesImported,
  onBackToProperties
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  // Handle Export GeoJSON
  const handleExportGeoJSON = async () => {
    try {
      const response = await api.get(`/properties/${property.id}/zones/export`);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(response.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `${property.name.toLowerCase().replace(/\s+/g, '_')}_zones.geojson`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      alert('Failed to export zones as GeoJSON.');
    }
  };

  // Handle Import GeoJSON
  const handleImportGeoJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError('');
    setImporting(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result;
        if (typeof text !== 'string') throw new Error('Could not read file.');
        
        const geojson = JSON.parse(text);
        
        // POST to import endpoint
        const response = await api.post(`/properties/${property.id}/zones/import`, geojson);
        onZonesImported(response.data);
        
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err: any) {
        setImportError(err.response?.data?.error || 'Invalid GeoJSON file structure or format.');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const getZoneTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      fairway: 'Fairway',
      rough: 'Rough',
      perimeter: 'Perimeter',
      exclusion: 'Exclusion'
    };
    return labels[type] || type;
  };

  const getZoneTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      fairway: 'bg-green-500/10 border-green-500/30 text-green-400',
      rough: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      perimeter: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
      exclusion: 'bg-red-500/10 border-red-500/30 text-red-400'
    };
    return colors[type] || 'bg-slate-500/10 border-slate-500/30 text-slate-400';
  };

  const getPropertyTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      golf_course: 'Golf Course',
      airport: 'Airport',
      corporate_campus: 'Corporate Campus',
      other: 'Other'
    };
    return labels[type] || type;
  };

  return (
    <div className="w-full lg:w-[420px] bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col h-full shrink-0 z-20">
      {/* Property Details Header */}
      <div className="p-6 border-b border-slate-800/80">
        <button 
          onClick={onBackToProperties}
          className="text-xs font-semibold text-slate-400 hover:text-white mb-4 flex items-center space-x-1 transition-colors"
        >
          <span>← Back to Properties</span>
        </button>
        
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 px-2 py-0.5 bg-blue-500/15 border border-blue-500/20 rounded-md">
              {getPropertyTypeLabel(property.type)}
            </span>
            <h2 className="text-xl font-extrabold text-white tracking-tight mt-2">{property.name}</h2>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2 line-clamp-2">{property.notes || 'No description notes.'}</p>
      </div>

      {/* Summary KPI Panel (TER-S02) */}
      <div className="grid grid-cols-2 border-b border-slate-800/80 bg-slate-950/40">
        <div className="p-4 border-r border-slate-800/80">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Acreage</p>
          <p className="text-lg font-bold text-slate-200 mt-1">{summary.total_acreage} <span className="text-[10px] font-semibold text-slate-500">Acres</span></p>
        </div>
        <div className="p-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Zones</p>
          <p className="text-lg font-bold text-slate-200 mt-1">{summary.total_zones} <span className="text-[10px] font-semibold text-slate-500">Areas</span></p>
        </div>
        <div className="p-4 border-t border-r border-slate-800/80">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Mowers</p>
          <p className="text-lg font-bold text-slate-200 mt-1">{summary.total_mowers_assigned} <span className="text-[10px] font-semibold text-slate-500">Mowers</span></p>
        </div>
        <div className="p-4 border-t border-slate-800/80">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Understaffed</p>
          <div className="flex items-center space-x-1.5 mt-1">
            <p className={`text-lg font-bold ${summary.understaffed_count > 0 ? 'text-orange-400' : 'text-green-400'}`}>
              {summary.understaffed_count}
            </p>
            {summary.understaffed_count > 0 && (
              <ShieldAlert className="h-4 w-4 text-orange-500 animate-pulse" />
            )}
          </div>
        </div>
      </div>

      {/* Action panel */}
      <div className="p-4 bg-slate-950/20 border-b border-slate-800/80 flex flex-wrap gap-2 items-center justify-between">
        <button
          onClick={onAddZoneClick}
          className="flex-1 flex items-center justify-center space-x-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all cursor-pointer shadow-md shadow-blue-500/5"
        >
          <Plus className="h-4 w-4" />
          <span>Draw Zone</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold px-2.5 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          title="Import GeoJSON features"
        >
          <Upload className="h-3.5 w-3.5" />
          <span>Import</span>
        </button>

        <button
          onClick={handleExportGeoJSON}
          className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold px-2.5 py-2 rounded-xl transition-colors cursor-pointer"
          title="Export current zones as GeoJSON"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export</span>
        </button>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImportGeoJSON}
          accept=".geojson,.json"
          className="hidden"
        />
      </div>

      {/* Import error overlay */}
      {importError && (
        <div className="mx-4 mt-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg flex items-start justify-between gap-1.5">
          <div className="flex items-start space-x-1.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
            <span>{importError}</span>
          </div>
          <button onClick={() => setImportError('')} className="text-red-400 hover:text-red-300">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Zone list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Zone Boundaries</h3>
        
        {zones.length === 0 ? (
          <div className="border border-dashed border-slate-800/80 rounded-2xl p-6 text-center text-slate-500 text-xs">
            No zones drawn yet. Click "Draw Zone" to begin mapping the area.
          </div>
        ) : (
          zones.map(zone => {
            const isSelected = selectedZone && selectedZone.id === zone.id;
            const hasConflicts = zone.conflicts.length > 0;
            
            return (
              <div
                key={zone.id}
                onClick={() => onZoneSelect(zone)}
                className={`group border rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  isSelected 
                    ? 'bg-slate-800/50 border-blue-500/60 shadow-lg shadow-blue-500/5' 
                    : 'bg-slate-900 border-slate-800/80 hover:border-slate-700/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className={`text-sm font-bold tracking-tight transition-colors ${
                      isSelected ? 'text-blue-400' : 'text-slate-200 group-hover:text-white'
                    }`}>
                      {zone.name}
                    </h4>
                    
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 border rounded-md uppercase tracking-wider ${getZoneTypeColor(zone.type)}`}>
                        {getZoneTypeLabel(zone.type)}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-850 border border-slate-800 text-slate-400 rounded-md">
                        {zone.mower_count} Mower{zone.mower_count !== 1 ? 's' : ''}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-850 border border-slate-800 text-slate-400 rounded-md">
                        {zone.acreage} Ac
                      </span>
                    </div>
                  </div>

                  {/* Warning Indicators */}
                  <div className="flex items-center space-x-1 shrink-0">
                    {hasConflicts && (
                      <span className="p-1 rounded bg-red-500/10 border border-red-500/20 text-red-400" title="Boundary Conflict (Overlapping zones)">
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </span>
                    )}
                    {zone.understaffed && (
                      <span className="p-1 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400" title="Understaffed: Acreage exceeds mower count capacity">
                        <ShieldAlert className="h-3.5 w-3.5 animate-pulse" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Sub-actions when selected */}
                {isSelected && (
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">
                      Status: {zone.status === 'active' ? 'Active Operations' : 'Inactive'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Are you sure you want to delete zone "${zone.name}"?`)) {
                          onZoneDelete(zone.id);
                        }
                      }}
                      className="flex items-center space-x-1 text-red-400 hover:text-red-300 font-semibold transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
