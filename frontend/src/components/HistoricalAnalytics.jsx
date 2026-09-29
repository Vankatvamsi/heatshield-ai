import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { TrendingUp, Activity, Calendar } from 'lucide-react';
import api from '../services/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function HistoricalAnalytics({ location }) {
  const [historyData, setHistoryData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filter params
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (location) {
      loadHistory();
    }
  }, [location, startDate, endDate]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const res = await api.getHistory(location.city, startDate || null, endDate || null);
      setHistoryData(res.data || []);

      const sumRes = await api.getHistorySummary(location.city);
      setSummary(sumRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Build chart dataset
  const chartData = {
    labels: historyData.map(d => d.date),
    datasets: [
      {
        label: 'Max Temperature (°C)',
        data: historyData.map(d => d.max_temperature),
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        tension: 0.3,
        fill: true,
        pointBackgroundColor: historyData.map(d => d.heatwave === 1 ? '#ef4444' : '#f97316'),
        pointBorderColor: historyData.map(d => d.heatwave === 1 ? '#ef4444' : '#f97316'),
        pointRadius: historyData.map(d => d.heatwave === 1 ? 6 : 2.5),
        pointHoverRadius: 8,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          afterLabel: (context) => {
            const dataIndex = context.dataIndex;
            const record = historyData[dataIndex];
            if (record && record.heatwave === 1) {
              return '⚠️ Heatwave Condition Triggered';
            }
            return '';
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: '#94a3b8',
          maxTicksLimit: 12,
        }
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: '#94a3b8',
        }
      }
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">

      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-orange-500" />
            Historical Heatwaves & Climate Trends
          </h2>
          <p className="text-xs text-slate-400">
            Audit historical logs and identify recurring seasonal anomaly timelines
          </p>
        </div>

        {/* Date Filters */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Start:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">End:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && summary.status === 'ok' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="glass-panel p-5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Observations</span>
            <p className="text-2xl font-black text-slate-100 mt-2">{summary.total_records} days</p>
          </div>

          <div className="glass-panel p-5 border-l-2 border-l-orange-500">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Heatwave Events</span>
            <p className="text-2xl font-black text-orange-400 mt-2">{summary.heatwave_days} days</p>
          </div>

          <div className="glass-panel p-5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Trigger Frequency</span>
            <p className="text-2xl font-black text-slate-100 mt-2">{summary.heatwave_percentage}%</p>
          </div>

          <div className="glass-panel p-5 border-l-2 border-l-red-500">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Max Temp Recorded</span>
            <p className="text-2xl font-black text-red-400 mt-2">{summary.max_temp_recorded?.toFixed(1)}°C</p>
          </div>
        </div>
      )}

      {/* Chart Panel */}
      <div className="glass-panel p-6">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-6">
          <Activity className="h-4.5 w-4.5 text-orange-500" />
          Maximum Temperature Profile & Heatwave Trigger Points
        </h3>

        {loading ? (
          <div className="h-96 flex items-center justify-center text-slate-400 text-xs">
            Querying logs...
          </div>
        ) : (
          <div className="h-96 relative">
            <Line data={chartData} options={chartOptions} />
          </div>
        )}
      </div>

    </div>
  );
}
