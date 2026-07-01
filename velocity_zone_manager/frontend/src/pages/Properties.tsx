import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Edit2, Trash2, SlidersHorizontal, LogOut, ChevronRight, Check } from 'lucide-react';
import api from '../utils/api';

interface Property {
  id: number;
  name: string;
  type: string;
  total_acreage: number;
  notes: string;
}

export default function Properties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [minAcreage, setMinAcreage] = useState('');
  const [maxAcreage, setMaxAcreage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentPropertyId, setCurrentPropertyId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'golf_course',
    total_acreage: '',
    notes: ''
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const userStr = localStorage.getItem('velocity_user');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        setUserEmail(u.email);
      } catch (e) {
        // ignore
      }
    }
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = {};
      if (search) params.search = search;
      if (filterType) params.type = filterType;
      if (minAcreage) params.min_acreage = minAcreage;
      if (maxAcreage) params.max_acreage = maxAcreage;

      const response = await api.get('/properties', { params });
      setProperties(response.data);
    } catch (err: any) {
      setError('Failed to fetch properties. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProperties();
  };

  const handleResetFilters = () => {
    setSearch('');
    setFilterType('');
    setMinAcreage('');
    setMaxAcreage('');
    setTimeout(() => {
      fetchProperties();
    }, 0);
  };

  const handleLogout = () => {
    localStorage.removeItem('velocity_token');
    localStorage.removeItem('velocity_user');
    navigate('/login');
  };

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setCurrentPropertyId(null);
    setFormData({
      name: '',
      type: 'golf_course',
      total_acreage: '',
      notes: ''
    });
    setFormError('');
    setShowModal(true);
  };

  const handleOpenEditModal = (property: Property) => {
    setIsEditing(true);
    setCurrentPropertyId(property.id);
    setFormData({
      name: property.name,
      type: property.type,
      total_acreage: property.total_acreage.toString(),
      notes: property.notes || ''
    });
    setFormError('');
    setShowModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    
    if (!formData.name.trim()) {
      setFormError('Property name is required.');
      return;
    }
    const acreage = parseFloat(formData.total_acreage);
    if (isNaN(acreage) || acreage < 0) {
      setFormError('Total acreage must be a positive number.');
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        name: formData.name,
        type: formData.type,
        total_acreage: acreage,
        notes: formData.notes
      };

      if (isEditing && currentPropertyId) {
        await api.put(`/properties/${currentPropertyId}`, payload);
      } else {
        await api.post('/properties', payload);
      }
      setShowModal(false);
      fetchProperties();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'An error occurred while saving the property.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteProperty = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This will delete all its zones permanently.`)) {
      return;
    }
    try {
      await api.delete(`/properties/${id}`);
      fetchProperties();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete property.');
    }
  };

  const getPropertyTypeLabel = (type: string) => {
    const mapping: Record<string, string> = {
      golf_course: 'Golf Course',
      airport: 'Airport',
      corporate_campus: 'Corporate Campus',
      other: 'Other'
    };
    return mapping[type] || type;
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-50 relative overflow-hidden">
      {/* Background Blurs */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[150px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-sky-500/5 rounded-full blur-[150px]" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white leading-none">Velocity</h1>
            <p className="text-xs text-slate-400 mt-1">Fleet Management Console</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden sm:block text-right">
            <p className="text-xs text-slate-400">Logged in as</p>
            <p className="text-sm font-medium text-slate-200">{userEmail || 'operator'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Log Out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 flex flex-col relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Properties</h2>
            <p className="text-sm text-slate-400 mt-1">Select a property to manage mowing zones and mower counts.</p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="self-start md:self-auto flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-xl shadow-lg hover:shadow-blue-500/10 transition-all cursor-pointer"
          >
            <Plus className="h-5 w-5" />
            <span>Add Property</span>
          </button>
        </div>

        {/* Filter bar */}
        <form onSubmit={handleSearchSubmit} className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-5 rounded-2xl mb-8 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search properties by name or type..."
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/80 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition-all"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-slate-950/60 border border-slate-800 focus:border-blue-500/80 rounded-xl px-4 py-2.5 text-sm text-slate-300 outline-none transition-all"
              >
                <option value="">All Types</option>
                <option value="golf_course">Golf Course</option>
                <option value="airport">Airport</option>
                <option value="corporate_campus">Corporate Campus</option>
                <option value="other">Other</option>
              </select>

              <div className="flex items-center space-x-2 bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-1.5">
                <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                <span className="text-xs text-slate-400 font-medium">Acreage:</span>
                <input
                  type="number"
                  placeholder="Min"
                  value={minAcreage}
                  onChange={(e) => setMinAcreage(e.target.value)}
                  className="w-16 bg-transparent border-0 p-0 text-xs text-white focus:ring-0 outline-none placeholder:text-slate-600"
                />
                <span className="text-slate-600 text-xs">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxAcreage}
                  onChange={(e) => setMaxAcreage(e.target.value)}
                  className="w-16 bg-transparent border-0 p-0 text-xs text-white focus:ring-0 outline-none placeholder:text-slate-600"
                />
              </div>

              <div className="flex gap-2 ml-auto lg:ml-0">
                <button
                  type="submit"
                  className="bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl border border-slate-700 transition-colors"
                >
                  Apply Filters
                </button>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-slate-400 hover:text-white text-sm font-medium px-3 py-2.5 transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Properties Grid */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
            <p className="text-slate-400 text-sm">Loading properties...</p>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-2xl text-center">
            <p>{error}</p>
            <button
              onClick={fetchProperties}
              className="mt-3 text-sm bg-red-500 text-white font-medium px-4 py-2 rounded-xl"
            >
              Retry
            </button>
          </div>
        ) : properties.length === 0 ? (
          <div className="flex-1 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center p-12 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="text-lg font-medium text-white">No properties found</h3>
            <p className="text-sm text-slate-500 max-w-sm mt-1">Get started by adding your first property or widening your filters.</p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-4 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-xl shadow-lg hover:shadow-blue-500/10"
            >
              Add Property
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((property) => (
              <div
                key={property.id}
                className="group bg-slate-900/50 hover:bg-slate-900/80 border border-slate-800/80 hover:border-blue-500/40 rounded-2xl shadow-xl flex flex-col justify-between overflow-hidden transition-all duration-300"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700/80 text-slate-300">
                      {getPropertyTypeLabel(property.type)}
                    </span>
                    
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditModal(property);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
                        title="Edit Details"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProperty(property.id, property.name);
                        }}
                        className="p-1.5 rounded-lg bg-red-950/20 hover:bg-red-900/30 text-red-400 hover:text-red-300 border border-red-900/30 hover:border-red-900/50 transition-colors"
                        title="Delete Property"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-white leading-tight group-hover:text-blue-400 transition-colors mb-2">
                    {property.name}
                  </h3>
                  
                  <p className="text-2xl font-bold tracking-tight text-slate-200 mb-3">
                    {property.total_acreage} <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Acres</span>
                  </p>

                  <p className="text-sm text-slate-400 line-clamp-2 h-10">
                    {property.notes || 'No description notes provided.'}
                  </p>
                </div>

                <button
                  onClick={() => navigate(`/properties/${property.id}`)}
                  className="bg-slate-900/80 group-hover:bg-blue-600 border-t border-slate-800/80 group-hover:border-t-blue-500 py-3.5 px-6 flex items-center justify-between text-sm font-semibold text-slate-300 group-hover:text-white transition-all cursor-pointer"
                >
                  <span>Manage Mowing Zones</span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Property CRUD Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">
                {isEditing ? 'Edit Property Details' : 'Add New Property'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white transition-colors text-sm font-semibold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-lg flex items-start space-x-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Property Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Bengaluru Golf Club"
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Property Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500/80 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none transition-all"
                  >
                    <option value="golf_course">Golf Course</option>
                    <option value="airport">Airport</option>
                    <option value="corporate_campus">Corporate Campus</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Total Acreage</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.total_acreage}
                    onChange={(e) => setFormData({ ...formData, total_acreage: e.target.value })}
                    placeholder="e.g. 120"
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Provide any additional details or operational guidelines..."
                  rows={3}
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none resize-none transition-all"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-all disabled:opacity-50"
                >
                  {formLoading ? 'Saving...' : 'Save Property'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
