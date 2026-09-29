import React, { useState, useEffect } from 'react';
import { Users, ShieldAlert, Heart, Calendar, HelpCircle, CheckCircle, RefreshCw, Sun } from 'lucide-react';
import api from '../services/api';

export default function VulnerableAdvisor({ location }) {
  const [categories, setCategories] = useState({});
  const [selectedCat, setSelectedCat] = useState('outdoor_worker');
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (location && selectedCat) {
      loadAssessment();
    }
  }, [location, selectedCat]);

  const loadCategories = async () => {
    try {
      const res = await api.getVulnerableCategories();
      setCategories(res.categories);
    } catch (e) {
      console.error(e);
    }
  };

  const loadAssessment = async () => {
    try {
      setLoading(true);
      const res = await api.getVulnerableRisk(
        location.city,
        location.latitude,
        location.longitude,
        selectedCat
      );
      setAssessment(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level) => {
    switch (level?.toUpperCase()) {
      case 'EXTREME': return 'text-red-400 border-red-500/30 bg-red-500/10';
      case 'HIGH': return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
      case 'MODERATE': return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
      default: return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-200">

      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Users className="h-6 w-6 text-orange-500" />
          Vulnerable Populations Risk Advisor
        </h2>
        <p className="text-xs text-slate-400">
          Targeted micro-assessments and physiological warning parameters for high-risk cohorts
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Cohort Selector */}
        <div className="glass-panel p-6 lg:col-span-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-2">
              <Heart className="h-4.5 w-4.5 text-orange-500" />
              Target Vulnerability Cohort
            </h3>

            <div className="space-y-2.5">
              {Object.entries(categories).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSelectedCat(key)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all duration-150 ${selectedCat === key
                      ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                      : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                    }`}
                >
                  <span>{label}</span>
                  {selectedCat === key && <span className="h-2 w-2 rounded-full bg-orange-500 animate-ping"></span>}
                </button>
              ))}
            </div>
          </div>

          <div className="text-[10px] text-slate-500 font-semibold bg-slate-900/50 p-3 rounded-xl border border-slate-800 mt-4 leading-relaxed">
            Note: Vulnerability classification offsets risk thresholds depending on metabolic rate, age, cardiovascular limits, and thermal exposure frequency.
          </div>
        </div>

        {/* Assessment & Advisory Output */}
        <div className="glass-panel p-6 lg:col-span-8">
          {loading || !assessment ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <Sun className="h-8 w-8 text-orange-500 animate-spin" />
              <p className="text-slate-400 text-xs">Computing biological stress threshold adjustments...</p>
            </div>
          ) : (
            <div className="space-y-6">

              {/* Assessment summary bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-900/40 border border-slate-800 p-4 rounded-2xl text-center">
                <div>
                  <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Base Risk Index</span>
                  <p className="text-sm font-bold text-slate-300 mt-1">{assessment.base_risk}</p>
                </div>

                <div className="border-l border-slate-800">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Cohort Severity</span>
                  <p className={`text-sm font-extrabold px-2 py-0.5 rounded-lg inline-block mt-1 ${getRiskColor(assessment.vulnerable_assessment.adjusted_risk)}`}>
                    {assessment.vulnerable_assessment.adjusted_risk}
                  </p>
                </div>

                <div className="border-l border-slate-800">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Heat Index</span>
                  <p className="text-sm font-bold text-slate-300 mt-1">{assessment.thermal_stress_score.toFixed(0)}</p>
                </div>

                <div className="border-l border-slate-800">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Sensitivity Limit</span>
                  <p className="text-sm font-bold text-slate-300 mt-1">
                    {selectedCat === 'general' ? '1.0x' : selectedCat === 'children' ? '1.4x' : selectedCat === 'elderly' ? '1.5x' : selectedCat === 'outdoor_worker' ? '1.6x' : '1.3x'} Multiplier
                  </p>
                </div>
              </div>

              {/* Warnings details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider border-b border-slate-800 pb-2">
                  Advisory Guidelines & Medical Interventions
                </h4>

                <div className="bg-orange-500/5 border border-orange-500/10 p-4 rounded-xl space-y-2">
                  <span className="text-[10px] uppercase font-bold text-orange-400">Trigger Conditions & Recommended Guideline</span>
                  <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                    {assessment.vulnerable_assessment.recommendation}
                  </p>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Symptomatic Watchlist / Bio-Signs</span>
                  <ul className="space-y-2 pl-1.5">
                    {(assessment.vulnerable_assessment.signs_to_watch || []).map((adv, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                        <span>{adv}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Technical block */}
              <div className="text-[10px] text-slate-500 border-t border-slate-800 pt-4 flex items-center justify-between">
                <span>Model Base: Physiological Thermal Load Matrix</span>
                <span>Category: {categories[selectedCat]}</span>
              </div>

            </div>
          )}
        </div>

      </div>

    </div>
  );
}
