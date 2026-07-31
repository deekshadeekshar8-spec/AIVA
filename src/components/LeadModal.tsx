import React from 'react';
import { X, Plus, Sparkles } from 'lucide-react';

interface LeadModalProps {
  show: boolean;
  onClose: () => void;
  form: {
    name: string;
    phone: string;
    source: 'Facebook Ads' | 'Google Ads' | 'Website' | 'Sell.Do' | 'Manual Entry' | 'API';
    project: string;
    budget: number;
    location: string;
  };
  setForm: React.Dispatch<React.SetStateAction<{
    name: string;
    phone: string;
    source: 'Facebook Ads' | 'Google Ads' | 'Website' | 'Sell.Do' | 'Manual Entry' | 'API';
    project: string;
    budget: number;
    location: string;
  }>>;
  onSubmit: (e: React.FormEvent) => void;
}

export default function LeadModal({ show, onClose, form, setForm, onSubmit }: LeadModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md">
      <div className="relative w-full max-w-md iceglass rounded-2xl p-6 overflow-hidden">
        
        {/* Holographic glowing lines */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-300 animate-pulse" />
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-100 font-mono">SIMULATE NEW INCOMING LEAD</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 transition-colors p-1 rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 text-xs">
          
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Prospect Name *</label>
            <input 
              type="text"
              required
              placeholder="e.g. John Doe"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="iceglass-input rounded-xl px-3.5 py-2.5 placeholder-slate-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Phone Number *</label>
            <input 
              type="tel"
              required
              placeholder="e.g. +1 (555) 019-2834"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="iceglass-input rounded-xl px-3.5 py-2.5 placeholder-slate-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Channel Source</label>
              <select 
                value={form.source}
                onChange={(e: any) => setForm({ ...form, source: e.target.value })}
                className="iceglass-input rounded-xl px-3.5 py-2.5 text-slate-100 cursor-pointer"
              >
                <option value="Facebook Ads" className="bg-slate-950">Facebook Ads</option>
                <option value="Google Ads" className="bg-slate-950">Google Ads</option>
                <option value="Website" className="bg-slate-950">Website</option>
                <option value="Sell.Do" className="bg-slate-950">Sell.Do</option>
                <option value="Manual Entry" className="bg-slate-950">Manual Entry</option>
                <option value="API" className="bg-slate-950">API Webhook</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Assigned Asset</label>
              <select 
                value={form.project}
                onChange={(e) => setForm({ ...form, project: e.target.value })}
                className="iceglass-input rounded-xl px-3.5 py-2.5 text-slate-100 cursor-pointer"
              >
                <option value="Astra Heights (Manhattan)" className="bg-slate-950">Astra Heights (NY)</option>
                <option value="Astra Meadows (Bangalore)" className="bg-slate-950">Astra Meadows (BLR)</option>
                <option value="Astra Smart duplexes (Chicago)" className="bg-slate-950">Astra Duplex (CHI)</option>
                <option value="Astra Grande (Mumbai)" className="bg-slate-950">Astra Grande (BOM)</option>
                <option value="Astra Vista (Delhi NCR)" className="bg-slate-950">Astra Vista (DEL)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Approx Budget ($)</label>
              <input 
                type="number"
                placeholder="e.g. 500000"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })}
                className="iceglass-input rounded-xl px-3.5 py-2.5 placeholder-slate-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Current Location</label>
              <input 
                type="text"
                placeholder="e.g. Chicago, IL"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="iceglass-input rounded-xl px-3.5 py-2.5 placeholder-slate-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="mt-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-black py-3 rounded-xl uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] cursor-pointer"
          >
            Insert Lead into CRM
          </button>
        </form>
      </div>
    </div>
  );
}
