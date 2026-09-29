import React, { useState } from 'react';
import { AlertCircle, MapPin, Navigation, Phone, Share2, Shield, Thermometer, Wind, X, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../services/api';

export default function HeatSafeSOS({ user, currentTemp, currentHumidity, currentRiskLevel, currentThermalStress }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState('button'); // button -> confirm -> loading -> active -> error
  const [loadingText, setLoadingText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [sosData, setSosData] = useState(null);
  
  const triggerSOS = async () => {
    setStep('loading');
    setErrorMsg('');
    
    if (!navigator.geolocation) {
      console.warn("Geolocation API not available. Using fallback coordinates.");
      // Fallback to a default location (e.g., Hyderabad)
      const fallbackLat = 17.3850;
      const fallbackLng = 78.4867;
      
      try {
        setLoadingText("Activating HeatSafe SOS...");
        setTimeout(() => setLoadingText("Checking current heat conditions (Fallback)..."), 500);
        
        const sosPayload = {
          latitude: fallbackLat,
          longitude: fallbackLng,
          temperature: currentTemp || 40.0,
          humidity: currentHumidity || 50.0,
          heatwave_risk_level: currentRiskLevel || "EXTREME",
          thermal_stress: currentThermalStress || 90.0,
        };
        
        setTimeout(() => setLoadingText("Finding nearby emergency assistance..."), 1000);
        
        const response = await fetch('http://127.0.0.1:8000/api/sos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
          },
          body: JSON.stringify(sosPayload)
        });
        
        const createdSos = await response.json();
        if (!response.ok) {
          throw new Error(createdSos.detail || "Failed to create SOS event.");
        }
        setSosData(createdSos);
        setStep('active');
        
      } catch (err) {
        console.error(err);
        setErrorMsg(err.message || "Failed to process SOS.");
        setStep('error');
      }
      return;
    }
    
    setLoadingText("Activating HeatSafe SOS...");
    setTimeout(() => setLoadingText("Getting your current location..."), 1000);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          setTimeout(() => setLoadingText("Checking current heat conditions..."), 500);
          
          const sosPayload = {
            latitude,
            longitude,
            temperature: currentTemp || 40.0,
            humidity: currentHumidity || 50.0,
            heatwave_risk_level: currentRiskLevel || "EXTREME",
            thermal_stress: currentThermalStress || 90.0,
          };
          
          setTimeout(() => setLoadingText("Finding nearby emergency assistance..."), 1000);
          
          const response = await fetch('http://127.0.0.1:8000/api/sos', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
            },
            body: JSON.stringify(sosPayload)
          });
          
          const createdSos = await response.json();
          if (!response.ok) {
            throw new Error(createdSos.detail || "Failed to create SOS event.");
          }
          
          setSosData(createdSos);
          setStep('active');
          
        } catch (error) {
          console.error(error);
          setErrorMsg(error.message || "Failed to process SOS.");
          setStep('error');
        }
      },
      (error) => {
        console.warn("Geolocation failed. Using fallback coordinates.", error);
        // Fallback to a default location (e.g., Hyderabad) if GPS fails
        const fallbackLat = 17.3850;
        const fallbackLng = 78.4867;
        
        try {
          setTimeout(() => setLoadingText("Checking current heat conditions (Fallback)..."), 500);
          
          const sosPayload = {
            latitude: fallbackLat,
            longitude: fallbackLng,
            temperature: currentTemp || 40.0,
            humidity: currentHumidity || 50.0,
            heatwave_risk_level: currentRiskLevel || "EXTREME",
            thermal_stress: currentThermalStress || 90.0,
          };
          
          setTimeout(() => setLoadingText("Finding nearby emergency assistance..."), 1000);
          
          fetch('http://127.0.0.1:8000/api/sos', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
            },
            body: JSON.stringify(sosPayload)
          })
          .then(async (response) => {
            const createdSos = await response.json();
            if (!response.ok) {
              throw new Error(createdSos.detail || "Failed to create SOS event.");
            }
            setSosData(createdSos);
            setStep('active');
          })
          .catch((err) => {
            console.error(err);
            setErrorMsg(err.message || "Failed to process SOS.");
            setStep('error');
          });
          
        } catch (err) {
          setErrorMsg("Failed to determine location and fallback failed.");
          setStep('error');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };
  
  const resolveSOS = async () => {
    if (sosData && sosData.id) {
      try {
        await fetch(`http://127.0.0.1:8000/api/sos/${sosData.id}/resolve`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
            },
            body: JSON.stringify({ status: 'RESOLVED' })
        });
      } catch (e) {
        console.error(e);
      }
    }
    setStep('button');
    setIsOpen(false);
    setSosData(null);
  };
  
  const handleShare = () => {
    if (navigator.share && sosData) {
      navigator.share({
        title: 'HeatSafe SOS Active',
        text: `HeatSafe SOS Activated. I am at Latitude: ${sosData.latitude}, Longitude: ${sosData.longitude}. Heat Risk is ${sosData.heatwave_risk_level}.`,
      }).catch(console.error);
    } else {
      alert("Sharing not supported on this device.");
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => { setIsOpen(true); setStep('confirm'); }}
        className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-red-900/50 transition-all border border-red-500 hover:scale-105"
      >
        <AlertCircle className="h-5 w-5 animate-pulse" />
        <span>HeatSafe SOS</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0f172a] border border-red-500/50 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-900 p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-white">
            <AlertCircle className="h-6 w-6 animate-pulse" />
            <h2 className="font-extrabold text-lg tracking-wide">HEATSAFE SOS</h2>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-red-200 hover:text-white transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 'confirm' && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto ring-4 ring-red-500/30">
                <AlertCircle className="h-10 w-10 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-white">Are you experiencing a heat-related emergency?</h3>
              <p className="text-slate-300 text-sm">
                HeatShield AI will use your current location and heat-risk information to find nearby emergency and heat-relief facilities, and automatically notify your emergency contact.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={triggerSOS}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-900/50 transition-colors flex items-center justify-center gap-2"
                >
                  <AlertCircle className="h-5 w-5" />
                  Confirm SOS
                </button>
              </div>
            </div>
          )}
          
          {step === 'loading' && (
            <div className="text-center space-y-4 py-8">
              <div className="w-16 h-16 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto"></div>
              <p className="text-slate-300 font-medium animate-pulse">{loadingText}</p>
            </div>
          )}
          
          {step === 'error' && (
            <div className="text-center space-y-6 py-4">
              <div className="text-amber-500 mx-auto w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-200">Action Required</h3>
              <p className="text-red-400 font-medium">{errorMsg}</p>
              <button 
                onClick={() => setIsOpen(false)}
                className="w-full py-3 bg-slate-800 text-white rounded-xl font-semibold"
              >
                Close
              </button>
            </div>
          )}
          
          {step === 'active' && sosData && (
            <div className="space-y-6">
              
              <div className="text-center border-b border-slate-700 pb-4">
                <h3 className="text-white font-black text-xl mb-1 flex items-center justify-center gap-2">
                  <AlertCircle className="text-red-500 h-6 w-6" /> HEATSAFE SOS ACTIVE
                </h3>
                <p className="text-slate-400 text-sm">Emergency assistance has been activated.</p>
              </div>

              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex items-start gap-2">
                  <MapPin className="h-5 w-5 text-blue-400 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-200 block">Your Location</span>
                    {sosData.address ? sosData.address : `${sosData.latitude.toFixed(4)}, ${sosData.longitude.toFixed(4)}`}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mt-3">
                  <Thermometer className="h-5 w-5 text-orange-400" />
                  <span className="font-bold text-slate-200">Heat Risk:</span> 
                  <span className="text-red-400 font-bold">{sosData.heatwave_risk_level}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="bg-slate-800/50 p-2 rounded flex flex-col items-center">
                    <span className="text-xs text-slate-400">Temperature</span>
                    <span className="font-bold text-white">{sosData.temperature}°C</span>
                  </div>
                  <div className="bg-slate-800/50 p-2 rounded flex flex-col items-center">
                    <span className="text-xs text-slate-400">Humidity</span>
                    <span className="font-bold text-white">{sosData.humidity}%</span>
                  </div>
                  <div className="bg-slate-800/50 p-2 rounded flex flex-col items-center col-span-2">
                    <span className="text-xs text-slate-400">Thermal Stress</span>
                    <span className="font-bold text-orange-400">{sosData.thermal_stress} / 100</span>
                  </div>
                </div>
              </div>

              {/* Nearest Hospital block */}
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">🏥 NEAREST HOSPITAL</h4>
                {sosData.hospital ? (
                  <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h5 className="font-bold text-slate-200">{sosData.hospital.name}</h5>
                        <p className="text-xs text-orange-400 mt-1">{sosData.hospital.distance_km} km away</p>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex items-center gap-2 text-xs">
                      {sosData.hospital.notification_status === 'SIMULATED' ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                          <span className="text-emerald-400 font-medium">Hospital notification simulated</span>
                        </>
                      ) : (
                        <span className="text-slate-500 font-medium">Notification not sent</span>
                      )}
                    </div>
                    {sosData.hospital.notification_status === 'SIMULATED' && (
                      <p className="text-[10px] text-slate-500 italic mt-1 ml-6">Demo Mode — No actual notification sent</p>
                    )}
                    
                    <div className="mt-4">
                       <a href={`https://www.google.com/maps/dir/?api=1&destination=${sosData.latitude},${sosData.longitude}`} target="_blank" rel="noreferrer" className="w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors">
                          <Navigation className="w-3.5 h-3.5" /> Navigate to Hospital
                        </a>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-800 rounded-xl text-center text-slate-400 text-sm">
                    Unable to find a nearby verified hospital.
                  </div>
                )}
              </div>
              
              {/* Emergency Call block */}
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">📞 EMERGENCY CALL</h4>
                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
                  <h5 className="font-bold text-slate-200">Emergency assistance contact</h5>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span className="text-emerald-400 font-medium">Call action simulated</span>
                  </div>
                  <p className="text-[10px] text-slate-500 italic mt-1 ml-6">Demo Mode — No actual call was placed</p>
                </div>
              </div>

              {/* Emergency Contact block */}
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">📱 EMERGENCY SMS</h4>
                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
                  <h5 className="font-bold text-slate-200">{sosData.emergency_contact?.phone || '+91 9827500473'}</h5>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    {sosData.emergency_contact?.notification_status === 'SIMULATED' ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                        <span className="text-emerald-400 font-medium">SMS notification simulated</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="text-amber-400 font-medium">SMS service is not configured</span>
                      </>
                    )}
                  </div>
                  {sosData.emergency_contact?.notification_status === 'SIMULATED' && (
                    <p className="text-[10px] text-slate-500 italic mt-1 ml-6">Demo Mode — No actual SMS was sent</p>
                  )}
                </div>
              </div>
              
            </div>
          )}
        </div>
        
        {/* Footer actions when active */}
        {step === 'active' && (
          <div className="bg-slate-900 p-4 border-t border-slate-800 flex gap-3">
            <button 
              onClick={resolveSOS}
              className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold shadow-lg shadow-green-900/20 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle className="h-5 w-5" /> Resolve SOS
            </button>
          </div>
        )}
        
      </div>
    </div>
  );
}
