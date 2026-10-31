import React, { useEffect, useState } from 'react';
import { UserPlusIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { createLead } from '../../api/leads';
import { getPropertyConfig } from '../../api/insights';

const SOURCES = ['Manual Entry', 'Organic', 'Referral', 'Website', 'Walk-in', 'Other'];

const AGENTS = [
{ id: '', label: 'Round Robin (auto-assign)' },
{ id: 'agent_1', label: 'Kavya' },
{ id: 'agent_2', label: 'Arjun' },
{ id: 'agent_3', label: 'Ananya' },
{ id: 'agent_4', label: 'Rohan' },
{ id: 'agent_5', label: 'Priya' },
{ id: 'agent_6', label: 'Vistara' }];


const MAX_ROWS = 10;

interface Row {
  name: string;
  phone: string;
  source: string;
  project: string;
  agentId: string;
}

function emptyRow(): Row {
  return { name: '', phone: '', source: 'Organic', project: '', agentId: '' };
}

interface QuickAddLeadsModalProps {
  onClose: () => void;
  onSaved: (count: number) => void;
}

export function QuickAddLeadsModal({ onClose, onSaved }: QuickAddLeadsModalProps) {
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [projects, setProjects] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPropertyConfig().
    then((cfg) => setProjects(Object.keys(cfg))).
    catch(() => setProjects([]));
  }, []);

  const updateRow = (index: number, updates: Partial<Row>) => {
    setRows((prev) => prev.map((r, i) => i === index ? { ...r, ...updates } : r));
  };

  const addRow = () => {
    if (rows.length >= MAX_ROWS) return;
    setRows((prev) => [...prev, emptyRow()]);
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.length === 1 ? prev : prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const filled = rows.filter((r) => r.name.trim() && r.phone.trim());
    if (filled.length === 0) {
      setError('Add at least one lead with a name and phone number.');
      return;
    }
    setSaving(true);
    setError(null);

    let succeeded = 0;
    const failures: string[] = [];
    for (const row of filled) {
      const res = await createLead({
        name: row.name.trim(),
        phone: row.phone.trim(),
        source: row.source || undefined,
        project: row.project || undefined,
        agentId: row.agentId || undefined
      });
      if (res.ok) succeeded++;
      else failures.push(`${row.name}: ${res.error}`);
    }

    setSaving(false);
    if (succeeded > 0) onSaved(succeeded);
    if (failures.length > 0) {
      setError(`${succeeded > 0 ? `${succeeded} saved. ` : ''}Failed: ${failures.join(' · ')}`);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/60 px-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass w-full max-w-3xl overflow-hidden rounded-2xl">

        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-agent-intent/15 text-agent-intent">
              <UserPlusIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold uppercase tracking-wide text-ink">Quick Add Leads</h2>
              <p className="text-[12px] text-ink-muted">Add up to {MAX_ROWS} leads manually with name &amp; phone — saved directly to the real CRM.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-white/[0.06] hover:text-ink">

            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {error && <p className="mb-3 text-[12.5px] text-red-400">{error}</p>}

          <div className="mb-2 hidden grid-cols-[1fr_1fr_0.8fr_0.9fr_0.9fr_32px] gap-2 px-1 text-[10px] uppercase tracking-widest text-ink-faint md:grid">
            <span>Name *</span>
            <span>Phone *</span>
            <span>Source</span>
            <span>Project</span>
            <span>Assign To</span>
            <span />
          </div>

          <div className="space-y-2">
            {rows.map((row, i) =>
            <div key={i} className="grid grid-cols-1 gap-2 rounded-xl border border-line bg-white/[0.02] p-2 md:grid-cols-[1fr_1fr_0.8fr_0.9fr_0.9fr_32px] md:border-0 md:bg-transparent md:p-0">
                <input
                value={row.name}
                onChange={(e) => updateRow(i, { name: e.target.value })}
                placeholder="Full name"
                className="rounded-lg border border-line bg-white/[0.04] px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-agent-intent/50 focus:outline-none" />

                <input
                value={row.phone}
                onChange={(e) => updateRow(i, { phone: e.target.value })}
                placeholder="+91..."
                className="rounded-lg border border-line bg-white/[0.04] px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-agent-intent/50 focus:outline-none" />

                <select
                value={row.source}
                onChange={(e) => updateRow(i, { source: e.target.value })}
                className="rounded-lg border border-line bg-white/[0.04] px-2 py-2 text-[12.5px] text-ink focus:border-agent-intent/50 focus:outline-none">

                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                value={row.project}
                onChange={(e) => updateRow(i, { project: e.target.value })}
                className="rounded-lg border border-line bg-white/[0.04] px-2 py-2 text-[12.5px] text-ink focus:border-agent-intent/50 focus:outline-none">

                  <option value="">— Select —</option>
                  {projects.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select
                value={row.agentId}
                onChange={(e) => updateRow(i, { agentId: e.target.value })}
                className="rounded-lg border border-line bg-white/[0.04] px-2 py-2 text-[12.5px] text-ink focus:border-agent-intent/50 focus:outline-none">

                  {AGENTS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
                <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={rows.length === 1}
                title="Remove row"
                className="grid h-9 w-9 place-items-center justify-self-end rounded-lg text-ink-faint transition-colors hover:bg-white/[0.06] hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30 md:justify-self-auto">

                  <Trash2Icon className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={addRow}
            disabled={rows.length >= MAX_ROWS}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-2.5 text-[12.5px] text-ink-muted transition-colors hover:border-agent-intent/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40">

            <PlusIcon className="h-3.5 w-3.5" /> Add another lead ({rows.length}/{MAX_ROWS})
          </button>
        </div>

        <div className="flex items-center gap-2 border-t border-line px-6 py-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-xl bg-agent-intent py-2.5 text-[13px] font-medium text-void disabled:opacity-50">

            {saving ? 'Saving…' : `Save Lead${rows.filter((r) => r.name.trim() && r.phone.trim()).length === 1 ? '' : 's'}`}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line px-5 py-2.5 text-[13px] text-ink-muted hover:text-ink">

            Close
          </button>
        </div>
      </div>
    </div>);

}
