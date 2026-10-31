import React, { useEffect, useState } from 'react';
import { LockIcon, PlusIcon, ShieldCheckIcon, Trash2Icon } from 'lucide-react';
import { Panel, Eyebrow } from '../components/ui/Panel';
import { cn } from '../utils/cn';
import { useAuth } from '../contexts/AuthContext';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getAuditLog,
  getPropertyConfig,
  getOmnidimSettings,
  getWhatsappHealth,
  type AivaUser,
  type AuditEvent,
  type PropertyConfigEntry } from
'../api/insights';

export function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [users, setUsers] = useState<AivaUser[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [propertyConfig, setPropertyConfig] = useState<Record<string, PropertyConfigEntry>>({});
  const [omnidim, setOmnidim] = useState<{ settings: Record<string, any>; configured: boolean } | null>(null);
  const [whatsapp, setWhatsapp] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'member' as 'admin' | 'member' });

  const load = async () => {
    setLoading(true);
    const [u, a, p, o, w] = await Promise.all([
    isAdmin ? getUsers().catch(() => []) : Promise.resolve([]),
    isAdmin ? getAuditLog(50).catch(() => []) : Promise.resolve([]),
    getPropertyConfig().catch(() => ({})),
    getOmnidimSettings().catch(() => null),
    getWhatsappHealth().catch(() => null)]
    );
    setUsers(u);
    setAudit(a);
    setPropertyConfig(p);
    setOmnidim(o);
    setWhatsapp(w);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createUser(form);
    if (res.ok && res.user) {
      setUsers((prev) => [...prev, res.user!]);
      setShowAdd(false);
      setForm({ username: '', password: '', role: 'member' });
      setNotice(`${res.user.username} added.`);
    } else {
      setNotice(res.error || 'Could not add user.');
    }
  };

  const handleToggleActive = async (u: AivaUser) => {
    if (u.env) return;
    setBusyId(u.id);
    const res = await updateUser(u.id, { active: !u.active });
    setBusyId(null);
    if (res.ok) {
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, active: !x.active } : x));
    } else {
      setNotice(res.error || 'Could not update user.');
    }
  };

  const handleDeleteUser = async (u: AivaUser) => {
    if (u.env) return;
    if (!window.confirm(`Remove ${u.username}?`)) return;
    setBusyId(u.id);
    const res = await deleteUser(u.id);
    setBusyId(null);
    if (res.ok) {
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      setNotice(`${u.username} removed.`);
    } else {
      setNotice(res.error || 'Could not remove user.');
    }
  };

  return (
    <div className="space-y-3">
      {notice && <div className="glass-soft rounded-xl px-4 py-2.5 text-[12.5px] text-ink">{notice}</div>}

      <Panel title="Settings" subtitle="Voices, permissions and the confirmation rules that gate sensitive CRM actions.">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/[0.06] px-4 py-3">
          <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <div className="text-[12.5px] leading-relaxed text-ink-muted">
            <p className="text-ink">Calling safety gate: real backend setting, not decorative</p>
            <p>
              Auto-dial is <span className="text-ink">{omnidim?.settings?.autoDialEnabled ? 'ON' : 'OFF'}</span> and WhatsApp
              auto-share is <span className="text-ink">{omnidim?.settings?.whatsappAutoShareEnabled ? 'ON' : 'OFF'}</span>.
              Nothing here dials or messages a real customer on its own while these stay off.
            </p>
          </div>
        </div>
      </Panel>

      <Panel title="Team & Roles" subtitle={isAdmin ? 'Real accounts stored in the backend' : 'Admin access required to manage the team'}>
        {!isAdmin &&
        <p className="text-[12.5px] text-ink-faint">Sign in as an admin to view and manage team accounts.</p>
        }
        {isAdmin &&
        <>
            <div className="mb-3 flex justify-end">
              <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 rounded-lg border border-agent-intent/50 bg-agent-intent/10 px-2.5 py-1.5 text-[11.5px] text-ink hover:bg-agent-intent/20">

                <PlusIcon className="h-3.5 w-3.5" /> Add Member
              </button>
            </div>
            <div className="divide-y divide-line">
              {users.map((u) =>
            <div key={u.id} className="flex items-center justify-between gap-3 py-2.5 text-[12.5px]">
                  <div>
                    <p className="text-ink">{u.username} {u.env && <span className="text-ink-faint">(env)</span>}</p>
                    <p className="text-[11px] text-ink-faint">{u.role} · {u.active ? 'active' : 'deactivated'}</p>
                  </div>
                  {!u.env &&
              <div className="flex gap-1.5">
                      <button
                  type="button"
                  disabled={busyId === u.id}
                  onClick={() => handleToggleActive(u)}
                  className="rounded-lg border border-line px-2 py-1 text-[11px] text-ink-muted hover:text-ink disabled:opacity-40">

                        {u.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                  type="button"
                  disabled={busyId === u.id}
                  onClick={() => handleDeleteUser(u)}
                  className="rounded-lg border border-line p-1.5 text-ink-muted hover:text-red-400 disabled:opacity-40">

                        <Trash2Icon className="h-3.5 w-3.5" />
                      </button>
                    </div>
              }
                </div>
            )}
              {!loading && users.length === 0 && <p className="py-4 text-center text-[12.5px] text-ink-faint">No team members yet.</p>}
            </div>
          </>
        }
      </Panel>

      <Panel title="Omnidimension &amp; Calling Rules" subtitle="Real safety configuration from the backend">
        {omnidim ?
        <div className="grid grid-cols-2 gap-3 text-[12.5px] sm:grid-cols-3">
            <div><p className="text-ink-faint">API Key Configured</p><p className="text-ink">{omnidim.configured ? 'Yes' : 'No'}</p></div>
            <div><p className="text-ink-faint">Auto-Dial</p><p className="text-ink">{omnidim.settings.autoDialEnabled ? 'Enabled' : 'Disabled'}</p></div>
            <div><p className="text-ink-faint">WhatsApp Auto-Share</p><p className="text-ink">{omnidim.settings.whatsappAutoShareEnabled ? 'Enabled' : 'Disabled'}</p></div>
            <div><p className="text-ink-faint">Human Handoff</p><p className="text-ink">{omnidim.settings.humanHandoffEnabled ? 'Enabled' : 'Disabled'}</p></div>
            <div>
              <p className="text-ink-faint">Calling Hours (IST)</p>
              <p className="text-ink">{omnidim.settings.callWindowStartHour}:00 – {omnidim.settings.callWindowEndHour}:00</p>
            </div>
            <div><p className="text-ink-faint">High-Value Budget Threshold</p><p className="text-ink">₹{Number(omnidim.settings.escalationHighValueBudget || 0).toLocaleString('en-IN')}</p></div>
          </div> :

        <p className="text-[12.5px] text-ink-faint">Could not load Omnidimension settings.</p>
        }
        <p className="mt-4 flex items-center gap-2 text-[11.5px] text-ink-faint">
          <LockIcon className="h-3.5 w-3.5" /> Editing these toggles is intentionally not exposed here while calling stays paused.
        </p>
      </Panel>

      <Panel title="WhatsApp Business" subtitle="Real Meta Cloud API connection status">
        {whatsapp ?
        <pre className="overflow-x-auto rounded-xl bg-white/[0.03] p-3 text-[11.5px] text-ink-muted">{JSON.stringify(whatsapp, null, 2)}</pre> :

        <p className="text-[12.5px] text-ink-faint">Could not load WhatsApp status.</p>
        }
      </Panel>

      <Panel title="Property Config" subtitle="Per-project WhatsApp sharing assets — real, admin-editable">
        <div className="space-y-3">
          {Object.entries(propertyConfig).map(([project, cfg]) =>
          <div key={project} className="rounded-xl border border-line bg-white/[0.02] px-4 py-3">
              <p className="text-[13px] text-ink">{project}</p>
              <p className="mt-1 text-[12px] text-ink-muted">{cfg.description || 'No description set yet.'}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-faint">
                <span>Brochure: {cfg.brochureUrl ? 'configured' : 'not set'}</span>
                <span>Location: {cfg.location?.latitude ? 'configured' : 'not set'}</span>
                <span>Highlights: {cfg.highlights?.length ?? 0}</span>
              </div>
            </div>
          )}
          {Object.keys(propertyConfig).length === 0 && <p className="text-[12.5px] text-ink-faint">No projects configured yet.</p>}
        </div>
      </Panel>

      {isAdmin &&
      <Panel title="Security / Audit Log" subtitle="Every authenticated non-GET request, plus failed logins">
          <div className="max-h-[360px] divide-y divide-line overflow-y-auto">
            {audit.map((ev, i) =>
          <div key={ev.id || i} className="py-2 text-[12px]">
                <div className="flex items-center justify-between text-ink-faint">
                  <span>{ev.username || 'unknown'}</span>
                  <span>{ev.time ? new Date(ev.time).toLocaleString() : ''}</span>
                </div>
                <p className="text-ink">{ev.method} {ev.path} {ev.status != null && <span className={cn(Number(ev.status) >= 400 ? 'text-red-400' : 'text-ink-muted')}>· {ev.status}</span>}</p>
              </div>
          )}
            {!loading && audit.length === 0 && <p className="py-4 text-center text-[12.5px] text-ink-faint">No audit events recorded yet.</p>}
          </div>
        </Panel>
      }

      {showAdd &&
      <div className="fixed inset-0 z-[200] grid place-items-center bg-black/60 px-4" onClick={() => setShowAdd(false)}>
          <form onSubmit={handleAddUser} onClick={(e) => e.stopPropagation()} className="glass w-full max-w-sm rounded-2xl p-6">
            <h2 className="text-[16px] font-semibold text-ink">Add Team Member</h2>
            <Eyebrow className="mt-4 block">Username</Eyebrow>
            <input
            required
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-line bg-white/[0.04] px-3 py-2 text-[13px] text-ink focus:border-agent-intent/50 focus:outline-none" />

            <Eyebrow className="mt-3 block">Password (min 8 characters)</Eyebrow>
            <input
            required
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-line bg-white/[0.04] px-3 py-2 text-[13px] text-ink focus:border-agent-intent/50 focus:outline-none" />

            <Eyebrow className="mt-3 block">Role</Eyebrow>
            <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'admin' | 'member' }))}
            className="mt-1 w-full rounded-lg border border-line bg-white/[0.04] px-3 py-2 text-[13px] text-ink focus:border-agent-intent/50 focus:outline-none">

              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 rounded-lg border border-line py-2 text-[12.5px] text-ink-muted hover:text-ink">
                Cancel
              </button>
              <button type="submit" className="flex-1 rounded-lg bg-agent-intent py-2 text-[12.5px] font-medium text-void">
                Add
              </button>
            </div>
          </form>
        </div>
      }
    </div>);

}
