import React, { useState, useEffect } from 'react';
import { 
  Search, Grid, List, Save, Trash2, Filter, Settings2, CheckCircle2, 
  ChevronDown, Signal, Activity, Smartphone, Monitor, Server, Cpu, 
  Zap, Battery, LayoutTemplate, ArrowUpDown, Check, X, Pencil, RotateCcw
} from 'lucide-react';
import { DeviceNode } from '../types';

interface SavedViewConfig {
    id: string;
    name: string;
    viewMode: 'grid' | 'list';
    filterType: string;
    searchQuery: string;
    sortBy: 'name' | 'signal' | 'rate' | 'latency';
    visibleColumns?: string[];
}

interface NetworkViewState {
    viewMode: 'grid' | 'list';
    filterType: string;
    sortBy: 'name' | 'signal' | 'rate' | 'latency';
    visibleColumns: string[];
}

interface Props {
  nodes: DeviceNode[];
  onConnectNode: (id: string) => void;
  onAutonomyUpdate: (nodeId: string, profile: 'provider' | 'balanced' | 'consumer') => void;
}

type ColumnKey = 'name' | 'type' | 'status' | 'signal' | 'rate' | 'latency' | 'autonomy' | 'ip';

const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
    { key: 'name', label: 'Nom du Nœud' },
    { key: 'ip', label: 'Adresse IP' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Statut' },
    { key: 'signal', label: 'Signal' },
    { key: 'rate', label: 'Débit' },
    { key: 'latency', label: 'Latence' },
    { key: 'autonomy', label: 'Profil' },
];

const DEFAULT_COLUMNS = ALL_COLUMNS.map(c => c.key);

export const NetworkView: React.FC<Props> = ({ nodes, onConnectNode, onAutonomyUpdate }) => {
  // --- State Initialization with Persistence ---
  
  const getInitialState = (): NetworkViewState => {
      try {
          const saved = localStorage.getItem('renumerate_network_state');
          if (saved) {
              return JSON.parse(saved);
          }
      } catch (e) {
          console.error("Failed to load network state", e);
      }
      return {
          viewMode: 'grid',
          filterType: 'all',
          sortBy: 'name',
          visibleColumns: DEFAULT_COLUMNS
      };
  };

  const initialState = getInitialState();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(initialState.viewMode);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>(initialState.filterType);
  const [sortBy, setSortBy] = useState<'name' | 'signal' | 'rate' | 'latency'>(initialState.sortBy);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(initialState.visibleColumns);
  
  // UI State
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showViewsMenu, setShowViewsMenu] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  // Edit State
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // --- Persistence Effects ---

  // Persist Current State
  useEffect(() => {
      const state: NetworkViewState = {
          viewMode,
          filterType,
          sortBy,
          visibleColumns
      };
      localStorage.setItem('renumerate_network_state', JSON.stringify(state));
  }, [viewMode, filterType, sortBy, visibleColumns]);

  // --- Saved Views Persistence ---
  const [savedViews, setSavedViews] = useState<SavedViewConfig[]>(() => {
      try {
          const saved = localStorage.getItem('renumerate_saved_views');
          return saved ? JSON.parse(saved) : [];
      } catch (e) {
          return [];
      }
  });

  useEffect(() => {
      localStorage.setItem('renumerate_saved_views', JSON.stringify(savedViews));
  }, [savedViews]);

  // --- Handlers ---

  const handleSaveView = () => {
      if (!newViewName.trim()) return;
      const newView: SavedViewConfig = {
          id: Date.now().toString(),
          name: newViewName,
          viewMode,
          filterType,
          searchQuery,
          sortBy,
          visibleColumns
      };
      setSavedViews(prev => [...prev, newView]);
      setActiveViewId(newView.id);
      setNewViewName('');
      setShowViewsMenu(false);
  };

  const handleLoadView = (view: SavedViewConfig) => {
      setViewMode(view.viewMode);
      setFilterType(view.filterType);
      setSearchQuery(view.searchQuery);
      setSortBy(view.sortBy);
      if (view.visibleColumns) setVisibleColumns(view.visibleColumns);
      setActiveViewId(view.id);
      setShowViewsMenu(false);
  };

  const handleDeleteView = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (activeViewId === id) setActiveViewId(null);
      setSavedViews(prev => prev.filter(v => v.id !== id));
  };

  const handleStartEdit = (view: SavedViewConfig, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingViewId(view.id);
      setEditName(view.name);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingViewId(null);
      setEditName('');
  };

  const handleSaveEdit = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (editingViewId && editName.trim()) {
          setSavedViews(prev => prev.map(v => 
              v.id === editingViewId ? { ...v, name: editName.trim() } : v
          ));
          setEditingViewId(null);
          setEditName('');
      }
  };

  const toggleColumn = (key: string) => {
      setActiveViewId(null); // Mark as modified
      setVisibleColumns(prev => 
          prev.includes(key) 
              ? prev.filter(k => k !== key)
              : [...prev, key]
      );
  };

  const handleResetFilters = () => {
      setFilterType('all');
      setSearchQuery('');
      setSortBy('name');
      setActiveViewId(null);
  };

  // --- Filtering & Sorting ---

  const filteredNodes = nodes
    .filter(n => {
        const matchesSearch = n.name.toLowerCase().includes(searchQuery.toLowerCase()) || n.ip.includes(searchQuery);
        const matchesType = filterType === 'all' || n.type === filterType;
        return matchesSearch && matchesType;
    })
    .sort((a, b) => {
        switch (sortBy) {
            case 'signal': return b.signalStrength - a.signalStrength;
            case 'rate': return b.transferRate - a.transferRate;
            case 'latency': return a.latency - b.latency;
            default: return a.name.localeCompare(b.name);
        }
    });

  // --- Helpers ---
  const getTypeIcon = (type: string) => {
      switch(type) {
          case 'mobile': return <Smartphone className="w-4 h-4" />;
          case 'server': return <Server className="w-4 h-4" />;
          case 'iot': return <Cpu className="w-4 h-4" />;
          default: return <Monitor className="w-4 h-4" />;
      }
  };

  const getAutonomyIcon = (profile: string) => {
      switch(profile) {
          case 'provider': return <Zap className="w-3.5 h-3.5" />;
          case 'consumer': return <Battery className="w-3.5 h-3.5" />;
          default: return <Activity className="w-3.5 h-3.5" />;
      }
  };

  return (
    <div className="h-full flex flex-col space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col xl:flex-row gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            
            {/* Search & Filters */}
            <div className="flex-1 flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Rechercher un nœud..." 
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setActiveViewId(null); }}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:border-brand-500 outline-none transition-colors dark:text-white"
                    />
                </div>
                
                <div className="relative min-w-[140px]">
                    <select
                        value={filterType}
                        onChange={(e) => { setFilterType(e.target.value); setActiveViewId(null); }}
                        className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-3 pr-8 text-sm focus:border-brand-500 outline-none cursor-pointer dark:text-white"
                    >
                        <option value="all">Tous types</option>
                        <option value="server">Serveurs</option>
                        <option value="mobile">Mobiles</option>
                        <option value="iot">IoT</option>
                    </select>
                    <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>

                <div className="relative min-w-[140px]">
                    <select
                        value={sortBy}
                        onChange={(e) => { setSortBy(e.target.value as any); setActiveViewId(null); }}
                        className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-8 text-sm focus:border-brand-500 outline-none cursor-pointer dark:text-white"
                    >
                        <option value="name">Nom</option>
                        <option value="signal">Signal</option>
                        <option value="rate">Débit</option>
                        <option value="latency">Latence</option>
                    </select>
                    <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>

                <button 
                    onClick={handleResetFilters}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                    title="Réinitialiser les filtres"
                >
                    <RotateCcw className="w-5 h-5" />
                </button>
            </div>

            {/* View Controls */}
            <div className="flex gap-3">
                {/* Saved Views Dropdown */}
                <div className="relative z-20">
                    <button 
                        onClick={() => setShowViewsMenu(!showViewsMenu)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                            activeViewId 
                            ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 border-brand-200 dark:border-brand-800' 
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                    >
                        <LayoutTemplate className="w-4 h-4" />
                        <span className="max-w-[100px] truncate">{activeViewId ? savedViews.find(v => v.id === activeViewId)?.name : 'Vues'}</span>
                        <ChevronDown className={`w-3 h-3 transition-transform ${showViewsMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {showViewsMenu && (
                        <>
                        <div className="fixed inset-0" onClick={() => setShowViewsMenu(false)}></div>
                        <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 animate-in fade-in zoom-in-95 duration-200">
                            <div className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1">Configurations</div>
                            <div className="space-y-1 mb-2 max-h-48 overflow-y-auto custom-scrollbar">
                                {savedViews.length === 0 ? (
                                    <p className="text-xs text-slate-400 px-2 py-2 italic text-center">Aucune vue sauvegardée</p>
                                ) : (
                                    savedViews.map(view => (
                                        <div key={view.id} className={`flex items-center justify-between group rounded-lg ${activeViewId === view.id && editingViewId !== view.id ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                            {editingViewId === view.id ? (
                                                <div className="flex items-center gap-1 flex-1 px-2 py-1">
                                                    <input 
                                                        type="text"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="flex-1 min-w-0 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1 outline-none focus:border-brand-500 dark:text-white"
                                                        autoFocus
                                                    />
                                                    <button onClick={handleSaveEdit} className="p-1 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded">
                                                        <Check className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={handleCancelEdit} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <button 
                                                        onClick={() => handleLoadView(view)}
                                                        className="flex-1 text-left px-2 py-2 text-sm text-slate-700 dark:text-slate-200 truncate flex items-center gap-2"
                                                    >
                                                        <span className="truncate">{view.name}</span>
                                                        {activeViewId === view.id && <Check className="w-3 h-3 text-brand-500 shrink-0" />}
                                                    </button>
                                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity px-1">
                                                        <button 
                                                            onClick={(e) => handleStartEdit(view, e)}
                                                            className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors"
                                                            title="Renommer"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button 
                                                            onClick={(e) => handleDeleteView(view.id, e)}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                            title="Supprimer"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="border-t border-slate-100 dark:border-slate-800 pt-2 px-1 flex gap-2">
                                <input 
                                    type="text" 
                                    placeholder="Nom de la vue..." 
                                    value={newViewName}
                                    onChange={(e) => setNewViewName(e.target.value)}
                                    className="flex-1 px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-brand-500 dark:text-white"
                                />
                                <button 
                                    onClick={handleSaveView}
                                    disabled={!newViewName.trim()}
                                    className="p-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                                >
                                    <Save className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        </>
                    )}
                </div>

                {/* Column Config (List Mode Only) */}
                {viewMode === 'list' && (
                    <div className="relative z-20">
                        <button
                            onClick={() => setShowColumnMenu(!showColumnMenu)}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            <Settings2 className="w-5 h-5" />
                        </button>
                        {showColumnMenu && (
                            <>
                            <div className="fixed inset-0" onClick={() => setShowColumnMenu(false)}></div>
                            <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 animate-in fade-in zoom-in-95 duration-200">
                                <div className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1">Colonnes</div>
                                <div className="space-y-0.5">
                                    {ALL_COLUMNS.map(col => (
                                        <button
                                            key={col.key}
                                            onClick={() => toggleColumn(col.key)}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
                                        >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                                visibleColumns.includes(col.key) 
                                                ? 'bg-brand-500 border-brand-500' 
                                                : 'border-slate-300 dark:border-slate-600'
                                            }`}>
                                                {visibleColumns.includes(col.key) && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className="text-slate-700 dark:text-slate-200">{col.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            </>
                        )}
                    </div>
                )}

                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button 
                        onClick={() => { setViewMode('grid'); setActiveViewId(null); }}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                    >
                        <Grid className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => { setViewMode('list'); setActiveViewId(null); }}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                    >
                        <List className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filteredNodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <Search className="w-12 h-12 mb-3 opacity-20" />
                    <p>Aucun nœud correspondant à vos critères.</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredNodes.map(node => (
                        <div key={node.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 hover:border-brand-500/50 dark:hover:border-brand-500/50 transition-all group hover:shadow-lg hover:shadow-brand-500/5">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-xl ${
                                        node.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                                        node.status === 'idle' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' :
                                        'bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400'
                                    }`}>
                                        {getTypeIcon(node.type)}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-white text-sm">{node.name}</div>
                                        <div className="text-[10px] text-slate-500 font-mono">{node.ip}</div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex bg-slate-50 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-100 dark:border-slate-700">
                                        {(['consumer', 'balanced', 'provider'] as const).map((mode) => (
                                            <button
                                                key={mode}
                                                onClick={(e) => { e.stopPropagation(); onAutonomyUpdate(node.id, mode); }}
                                                className={`p-1 rounded-md transition-all ${
                                                    node.autonomyProfile === mode 
                                                    ? 'bg-white dark:bg-slate-700 shadow-sm text-brand-600 dark:text-brand-400 ring-1 ring-black/5 dark:ring-white/5' 
                                                    : 'text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400'
                                                }`}
                                                title={mode.charAt(0).toUpperCase() + mode.slice(1)}
                                            >
                                                {getAutonomyIcon(mode)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-xs text-slate-500">
                                    <span className="flex items-center gap-1.5"><Signal className="w-3.5 h-3.5" /> Signal</span>
                                    <div className="flex gap-0.5">
                                        {[1,2,3,4].map(i => (
                                            <div key={i} className={`w-1.5 h-3 rounded-sm ${i <= Math.ceil(node.signalStrength / 25) ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                                        ))}
                                    </div>
                                </div>
                                
                                <div className="flex justify-between items-center text-xs text-slate-500">
                                    <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Latence</span>
                                    <span className={`font-mono font-bold ${node.latency < 50 ? 'text-emerald-500' : node.latency < 100 ? 'text-amber-500' : 'text-red-500'}`}>
                                        {node.latency}ms
                                    </span>
                                </div>

                                <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                                    <button 
                                        onClick={() => onConnectNode(node.id)}
                                        className="flex-1 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition-opacity"
                                    >
                                        Connecter
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                            <tr>
                                {ALL_COLUMNS.filter(c => visibleColumns.includes(c.key)).map(col => (
                                    <th 
                                        key={col.key}
                                        onClick={() => {
                                            if(['name','signal','rate','latency'].includes(col.key)) {
                                                setSortBy(col.key as any);
                                                setActiveViewId(null);
                                            }
                                        }}
                                        className={`px-4 py-3 font-medium text-slate-500 dark:text-slate-400 ${['name','signal','rate','latency'].includes(col.key) ? 'cursor-pointer hover:text-slate-800 dark:hover:text-white' : ''}`}
                                    >
                                        <div className="flex items-center gap-1">
                                            {col.label}
                                            {sortBy === col.key && <ChevronDown className="w-3 h-3 text-brand-500" />}
                                        </div>
                                    </th>
                                ))}
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredNodes.map(node => (
                                <tr key={node.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                                    {visibleColumns.includes('name') && (
                                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                                            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                {getTypeIcon(node.type)}
                                            </div>
                                            {node.name}
                                        </td>
                                    )}
                                    {visibleColumns.includes('ip') && <td className="px-4 py-3 text-slate-500 font-mono text-xs">{node.ip}</td>}
                                    {visibleColumns.includes('type') && <td className="px-4 py-3 text-slate-500 capitalize">{node.type}</td>}
                                    {visibleColumns.includes('status') && (
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                                                node.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                                                'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                            }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${node.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                                                {node.status}
                                            </span>
                                        </td>
                                    )}
                                    {visibleColumns.includes('signal') && (
                                        <td className="px-4 py-3 text-slate-500">
                                            <div className="flex items-center gap-2">
                                                <Signal className={`w-4 h-4 ${node.signalStrength > 70 ? 'text-emerald-500' : 'text-amber-500'}`} />
                                                <span className="font-mono text-xs">{node.signalStrength}%</span>
                                            </div>
                                        </td>
                                    )}
                                    {visibleColumns.includes('rate') && <td className="px-4 py-3 text-slate-500 font-mono">{node.transferRate} MB/s</td>}
                                    {visibleColumns.includes('latency') && <td className="px-4 py-3 text-slate-500 font-mono">{node.latency}ms</td>}
                                    {visibleColumns.includes('autonomy') && (
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 w-fit rounded-lg p-0.5 border border-slate-100 dark:border-slate-700">
                                                {(['consumer', 'balanced', 'provider'] as const).map((mode) => (
                                                    <button
                                                        key={mode}
                                                        onClick={(e) => { e.stopPropagation(); onAutonomyUpdate(node.id, mode); }}
                                                        className={`p-1 rounded-md transition-all ${
                                                            node.autonomyProfile === mode 
                                                            ? 'bg-white dark:bg-slate-700 shadow-sm text-brand-600 dark:text-brand-400 ring-1 ring-black/5 dark:ring-white/5' 
                                                            : 'text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400'
                                                        }`}
                                                        title={mode.charAt(0).toUpperCase() + mode.slice(1)}
                                                    >
                                                        {getAutonomyIcon(mode)}
                                                    </button>
                                                ))}
                                            </div>
                                        </td>
                                    )}
                                    <td className="px-4 py-3 text-right">
                                        <button 
                                            onClick={() => onConnectNode(node.id)}
                                            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-brand-500 hover:text-white dark:hover:bg-brand-500 dark:hover:text-white text-slate-600 dark:text-slate-300 text-xs font-bold transition-all"
                                        >
                                            Connecter
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    </div>
  );
};