import React, { useState, useEffect } from 'react';
import { Save, X, AlertOctagon, HelpCircle, ShieldAlert } from 'lucide-react';
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

interface ZoneFormProps {
  propertyId: number;
  zone: Zone | null; // Null if creating a new zone
  newGeometry: any | null; // Passed when creating a new zone
  onSave: (savedZone: Zone) => void;
  onCancel: () => void;
}

export default function ZoneForm({
  propertyId,
  zone,
  newGeometry,
  onSave,
  onCancel
}: ZoneFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState('rough');
  const [mowerCount, setMowerCount] = useState('1');
  const [status, setStatus] = useState('active');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (zone) {
      setName(zone.name);
      setType(zone.type);
      setMowerCount(zone.mower_count.toString());
      setStatus(zone.status);
    } else {
      setName('');
      setType('rough');
      setMowerCount('1');
      setStatus('active');
    }
    setError('');
  }, [zone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Zone name is required.');
      return;
    }

    const mowers = parseInt(mowerCount);
    if (isNaN(mowers)) {
      setError('Mower count must be a number.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name,
        type,
        mower_count: mowers,
        status,
        geometry: zone ? zone.geometry : newGeometry
      };

      let response;
      if (zone) {
        // Edit existing
        response = await api.put(`/properties/${propertyId}/zones/${zone.id}`, payload);
      } else {
        // Create new
        response = await api.post(`/properties/${propertyId}/zones`, payload);
      }

      onSave(response.data);
    } catch (err: any) {
      // TER-S02: Display backend error inline
      setError(err.response?.data?.error || 'An error occurred while saving the zone details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-45 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full animate-slide-in">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">
            {zone ? 'Zone Settings' : 'New Mowing Zone'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {zone ? 'Modify operational details' : 'Configure drawn polygon boundaries'}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Form body */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {/* Inline Backend Error (TER-S02) */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3.5 rounded-xl flex items-start space-x-2">
              <AlertOctagon className="h-4.5 w-4.5 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Understaffed Warning helper (frontend hint) */}
          {zone && zone.understaffed && (
            <div className="bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs px-4 py-3 rounded-xl flex items-start space-x-2">
              <ShieldAlert className="h-4.5 w-4.5 shrink-0 text-orange-400 mt-0.5 animate-pulse" />
              <div>
                <p className="font-bold">Understaffed Warning</p>
                <p className="text-[11px] text-orange-500/90 mt-0.5">This zone requires more mowers. Capacity is limited to 2 acres per mower.</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Zone Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Fairway West 2"
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-650 outline-none transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Zone Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500/80 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none transition-all"
            >
              <option value="fairway">Fairway</option>
              <option value="rough">Rough</option>
              <option value="perimeter">Perimeter</option>
              <option value="exclusion">Exclusion (No Mow Zone)</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Mower Allocation</label>
              <span className="text-[10px] text-slate-500">Min 1 required</span>
            </div>
            <input
              type="number"
              value={mowerCount}
              onChange={(e) => setMowerCount(e.target.value)}
              placeholder="e.g. 3"
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-650 outline-none transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Operational Status</label>
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="active"
                  checked={status === 'active'}
                  onChange={() => setStatus('active')}
                  className="bg-slate-950 border-slate-800 text-blue-600 focus:ring-0"
                />
                <span>Active</span>
              </label>
              <label className="flex items-center space-x-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="inactive"
                  checked={status === 'inactive'}
                  onChange={() => setStatus('inactive')}
                  className="bg-slate-950 border-slate-800 text-blue-600 focus:ring-0"
                />
                <span>Inactive</span>
              </label>
            </div>
          </div>

          {zone && (
            <div className="pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-semibold text-slate-500 uppercase tracking-wide">Calculated Acreage</p>
                <p className="text-sm font-bold text-slate-200 mt-1">{zone.acreage} Acres</p>
              </div>
              <div>
                <p className="font-semibold text-slate-500 uppercase tracking-wide">Staffing status</p>
                <p className={`text-sm font-bold mt-1 ${zone.understaffed ? 'text-orange-400' : 'text-green-400'}`}>
                  {zone.understaffed ? 'Understaffed' : 'Sufficiently Staffed'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="p-6 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg transition-all flex items-center space-x-2 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{loading ? 'Saving...' : 'Save Zone'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
