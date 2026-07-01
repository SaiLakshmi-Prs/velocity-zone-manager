import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Sidebar from '../components/Sidebar';
import MapContainer from '../components/MapContainer';
import ZoneForm from '../components/ZoneForm';

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

interface Property {
  id: number;
  name: string;
  type: string;
  total_acreage: number;
  notes: string;
}

export default function Dashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const propertyId = parseInt(id || '');

  const [property, setProperty] = useState<Property | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total_zones: 0,
    total_acreage: 0.0,
    total_mowers_assigned: 0,
    understaffed_count: 0
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [newGeometry, setNewGeometry] = useState<any | null>(null);
  const [showZoneForm, setShowZoneForm] = useState(false);

  useEffect(() => {
    if (isNaN(propertyId)) {
      navigate('/');
      return;
    }
    loadDashboardData();
  }, [propertyId]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const [propRes, zonesRes, summaryRes] = await Promise.all([
        api.get(`/properties/${propertyId}`),
        api.get(`/properties/${propertyId}/zones`),
        api.get(`/properties/${propertyId}/zones/summary`)
      ]);

      setProperty(propRes.data);
      setZones(zonesRes.data);
      setSummary(summaryRes.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const reloadZonesAndSummary = async () => {
    try {
      const [zonesRes, summaryRes] = await Promise.all([
        api.get(`/properties/${propertyId}/zones`),
        api.get(`/properties/${propertyId}/zones/summary`)
      ]);
      setZones(zonesRes.data);
      setSummary(summaryRes.data);
      
      if (selectedZone) {
        const updated = zonesRes.data.find((z: Zone) => z.id === selectedZone.id);
        setSelectedZone(updated || null);
      }
    } catch (err) {
      console.error('Failed to reload zone data:', err);
    }
  };

  const handleZoneSelect = (zone: Zone | null) => {
    setSelectedZone(zone);
    if (zone) {
      setShowZoneForm(false);
      setNewGeometry(null);
    }
  };

  const handleZoneDelete = async (zoneId: number) => {
    try {
      await api.delete(`/properties/${propertyId}/zones/${zoneId}`);
      setSelectedZone(null);
      await reloadZonesAndSummary();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete zone.');
    }
  };

  const handleZoneDrawEnd = (geometry: any) => {
    setNewGeometry(geometry);
    setSelectedZone(null);
    setShowZoneForm(true);
  };

  const handleZoneBoundaryUpdate = async (zoneId: number, geometry: any) => {
    try {
      const z = zones.find(z => z.id === zoneId);
      if (!z) return;

      const payload = {
        name: z.name,
        type: z.type,
        mower_count: z.mower_count,
        status: z.status,
        geometry
      };

      await api.put(`/properties/${propertyId}/zones/${zoneId}`, payload);
      await reloadZonesAndSummary();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update zone boundary.');
      await reloadZonesAndSummary();
    }
  };

  const handleZoneSave = async (savedZone: Zone) => {
    setShowZoneForm(false);
    setNewGeometry(null);
    await reloadZonesAndSummary();
    setSelectedZone(savedZone);
  };

  const handleZoneFormCancel = () => {
    setShowZoneForm(false);
    setNewGeometry(null);
    setSelectedZone(null);
    reloadZonesAndSummary();
  };

  const handleZonesImported = (importedZones: Zone[]) => {
    setZones(importedZones);
    setSelectedZone(null);
    api.get(`/properties/${propertyId}/zones/summary`).then(res => setSummary(res.data));
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-400">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p>Loading Velocity Workspace...</p>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-400 p-4 text-center">
        <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl max-w-md">
          <h3 className="text-white font-bold text-lg mb-2">Workspace Error</h3>
          <p className="text-sm mb-4">{error || 'Property details could not be loaded.'}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            Return to Properties
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col lg:flex-row bg-slate-950 overflow-hidden">
      <Sidebar
        property={property}
        zones={zones}
        summary={summary}
        selectedZone={selectedZone}
        onZoneSelect={handleZoneSelect}
        onAddZoneClick={() => setIsDrawingMode(true)}
        onZoneDelete={handleZoneDelete}
        onZonesImported={handleZonesImported}
        onBackToProperties={() => navigate('/')}
      />

      <div className="flex-1 h-full relative">
        <MapContainer
          zones={zones}
          selectedZone={selectedZone}
          onZoneSelect={handleZoneSelect}
          onZoneDrawEnd={handleZoneDrawEnd}
          onZoneBoundaryUpdate={handleZoneBoundaryUpdate}
          isDrawingMode={isDrawingMode}
          setIsDrawingMode={setIsDrawingMode}
        />
      </div>

      {(showZoneForm || selectedZone) && (
        <ZoneForm
          propertyId={propertyId}
          zone={selectedZone}
          newGeometry={newGeometry}
          onSave={handleZoneSave}
          onCancel={handleZoneFormCancel}
        />
      )}
    </div>
  );
}
