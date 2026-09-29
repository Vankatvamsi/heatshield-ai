import React, { useState, useEffect } from 'react';
import { Flame, ShieldAlert, Cpu, Sparkles, Building, Info } from 'lucide-react';
import api from '../services/api';

export default function UhiHotspots({ location }) {
  const [hotspots, setHotspots] = useState([]);
  const [baseTemp, setBaseTemp] = useState(40.0);
  const [loading, setLoading] = useState(true);

  // Simulator inputs
  const [urbanTemp, setUrbanTemp] = useState(42.5);
  const [landCover, setLandCover] = useState('CBD');
  const [vegIndex, setVegIndex] = useState(0.15);
  const [simulationResult, setSimulationResult] = useState(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    if (location) {
      loadHotspots();
    }
  }, [location, baseTemp]);

  const loadHotspots = async () => {
    try {
      setLoading(true);
      const res = await api.getUhiHotspots(location.city, baseTemp);
      setHotspots(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = async (e) => {
    e.preventDefault();
    setSimulating(true);
    try {
      const res = await api.computeUhi({
        urbanTemp,
        landCover,
        vegetationIndex: vegIndex
      });
      setSimulationResult(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">

      {/* Description header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Building className="h-6 w-6 text-orange-500" />
          Urban Heat Islands (UHI) & Microclimates
        </h2>
        <p className="text-xs text-slate-400">
          Analyze localized heating variances due to urban building density, lack of vegetation canopy, and materials
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Hotspots Panel */}
        <div className="glass-panel p-6 lg:col-span-7">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Flame className="h-4.5 w-4.5 text-orange-500" />
              Microclimate Hotspots – {location?.city}
            </h3>

            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-400">Base Temp Reference:</span>
              <input
                type="number"
                step="0.5"
                value={baseTemp}
                onChange={(e) => setBaseTemp(parseFloat(e.target.value))}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-white text-xs w-16 focus:outline-none focus:ring-1 focus:ring-orange-500 font-semibold"
              />
              <span className="text-slate-400">°C</span>
            </div>
          </div>

          {loading ? (
            <div className="text-slate-400 text-xs py-8 text-center">Loading spatial spots...</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-12 text-[10px] uppercase font-bold tracking-wider text-slate-500 border-b border-slate-800 pb-2 px-2">
                <span className="col-span-4">Zone / Neighborhood</span>
                <span className="col-span-3 text-center">UHI Intensity</span>
                <span className="col-span-2 text-center">Ambient</span>
                <span className="col-span-3 text-right">Anomaly Level</span>
              </div>

              {hotspots.map((spot, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 items-center text-xs py-3 px-2 border-b border-slate-800 hover:bg-slate-900/20 rounded-lg transition-colors duration-100"
                >
                  <div className="col-span-4 flex flex-col">
                    <span className="font-bold text-slate-200">{spot.name}</span>
                    <span className="text-[10px] text-slate-400">{spot.land_cover}</span>
                  </div>

                  <div className="col-span-3 text-center">
                    <span className="font-extrabold text-orange-400">+{spot.uhi_intensity.toFixed(1)}°C</span>
                  </div>

                  <div className="col-span-2 text-center font-semibold text-slate-300">
                    {(spot.urban_temperature || 0).toFixed(1)}°C
                  </div>

                  <div className="col-span-3 text-right">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${spot.classification === 'Extreme' ? 'bg-red-500/10 text-red-400' :
                        spot.classification === 'High' ? 'bg-orange-500/10 text-orange-400' :
                          'bg-amber-500/10 text-amber-400'
                      }`}>
                      {spot.classification}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Simulator Panel */}
        <div className="glass-panel p-6 lg:col-span-5 flex flex-col justify-between">
          <form onSubmit={handleSimulate} className="space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-2">
              <Cpu className="h-4.5 w-4.5 text-orange-500" />
              Microclimate UHI Simulator
            </h3>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Urban Ambient Temp (°C)</label>
              <input
                type="number"
                step="0.1"
                required
                value={urbanTemp}
                onChange={(e) => setUrbanTemp(parseFloat(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Land Cover / Material Profile</label>
              <select
                value={landCover}
                onChange={(e) => setLandCover(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="CBD">High-Density CBD (Asphalt/Concrete)</option>
                <option value="Industrial">Industrial Zone (Metal Roofs/Sparse Trees)</option>
                <option value="Residential">Suburban Residential (Brick/Some Canopies)</option>
                <option value="Rural">Rural Fringe (Farmland/Grass)</option>
                <option value="Park">Urban Forest / Public Park (Rich Canopy)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex justify-between">
                <span>NDVI Vegetation Index</span>
                <span className="text-orange-400 font-bold">{vegIndex}</span>
              </label>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={vegIndex}
                onChange={(e) => setVegIndex(parseFloat(e.target.value))}
                className="w-full accent-orange-500 cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-bold mt-1">
                <span>Concrete Desert (0.0)</span>
                <span>Dense Forestry (1.0)</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={simulating}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-xl text-xs transition-all duration-150 shadow-md shadow-orange-500/10"
            >
              {simulating ? 'Simulating...' : 'Run UHI Evaluation'}
            </button>
          </form>

          {/* Simulation Output */}
          {simulationResult && (
            <div className="mt-6 p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Simulation Output</span>
                <span className="text-xs font-bold text-orange-400 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> Calculated Delta
                </span>
              </div>

              <div className="flex justify-between items-baseline border-b border-slate-800 pb-2.5">
                <span className="text-xs text-slate-300">Surface Temp Delta:</span>
                <span className="text-lg font-black text-slate-100">
                  +{simulationResult.uhi_intensity.toFixed(2)}°C
                </span>
              </div>

              <div className="flex justify-between items-baseline border-b border-slate-800 pb-2.5">
                <span className="text-xs text-slate-300">NDVI Cooling Offset:</span>
                <span className="text-xs font-semibold text-emerald-400">
                  -{(simulationResult.vegetation_index * 2.0).toFixed(2)}°C
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">Adaptive Urban Mitigation</span>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {simulationResult.land_cover === 'CBD' ? "Deploy reflective roof coatings (cool roofs), street tree canopies, and permeable green parking modules." :
                    simulationResult.land_cover === 'Industrial' ? "Implement solar shading structures, extensive cool roofs on warehouses, and perimeter tree buffers." :
                      simulationResult.land_cover === 'Residential' ? "Increase urban forestry cover, high-albedo residential driveway coatings, and pocket park integrations." :
                        "Maintain vegetative natural preserves and reduce the layout footprint of impervious concrete/asphalt."}
                </p>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
