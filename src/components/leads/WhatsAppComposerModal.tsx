import React, { useEffect, useState } from 'react';
import { XIcon, MessageSquareIcon, FileTextIcon, MapPinIcon, Link2Icon, ImageIcon, SendIcon, Loader2Icon, CheckCircle2Icon, XCircleIcon, AlertTriangleIcon } from 'lucide-react';
import type { Lead } from '../../api/types';
import { getWhatsAppComposePreview, sendWhatsAppCompose, type WhatsAppComposePreview, type WhatsAppSendItemResult } from '../../api/leads';

interface WhatsAppComposerModalProps {
  show: boolean;
  onClose: () => void;
  lead: Lead | null;
  onSent?: (updatedLead: Lead) => void;
}

export function WhatsAppComposerModal({ show, onClose, lead, onSent }: WhatsAppComposerModalProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<WhatsAppComposePreview | null>(null);
  const [message, setMessage] = useState('');
  const [project, setProject] = useState('');

  const [sendMessage, setSendMessage] = useState(true);
  const [sendBrochure, setSendBrochure] = useState(true);
  const [sendLocation, setSendLocation] = useState(false);
  const [sendMapsLink, setSendMapsLink] = useState(true);
  const [sendImages, setSendImages] = useState(false);

  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<WhatsAppSendItemResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = async (projectOverride?: string) => {
    if (!lead) return;
    setLoading(true);
    setResults(null);
    setError(null);
    const data = await getWhatsAppComposePreview(lead.id, projectOverride);
    setLoading(false);
    if (!data) {
      setError('Could not load WhatsApp composer — backend unreachable.');
      return;
    }
    setPreview(data);
    setMessage(data.message);
    setProject(data.project || '');
    setSendBrochure(data.brochureAvailable);
    setSendLocation(data.locationAvailable);
    setSendMapsLink(!!data.mapsLink);
    setSendImages(data.images.length > 0);
  };

  useEffect(() => {
    if (show && lead) loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, lead?.id]);

  if (!show || !lead) return null;

  const nothingSelected = !sendMessage && !sendBrochure && !sendLocation && !sendMapsLink && !sendImages;

  const handleSend = async () => {
    if (!preview) return;
    if (!preview.phoneValid) {
      setError(`"${lead.phone}" doesn't look like a valid WhatsApp number.`);
      return;
    }
    if (nothingSelected) {
      setError('Select at least one thing to send.');
      return;
    }
    setSending(true);
    setResults(null);
    setError(null);
    const res = await sendWhatsAppCompose(lead.id, {
      project: project || undefined,
      message: sendMessage ? message : undefined,
      sendMessage,
      sendBrochure,
      sendLocation,
      sendMapsLink,
      sendImages,
    });
    setSending(false);
    if (res.results) setResults(res.results);
    if (res.ok && res.lead) {
      onSent?.(res.lead);
    } else {
      setError(res.error || 'WhatsApp send failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/60 px-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6">

        <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <MessageSquareIcon className="h-4 w-4 text-agent-sentiment" />
            <div>
              <h3 className="text-[14px] font-semibold text-ink">Send WhatsApp</h3>
              <p className="text-[11px] text-ink-faint">{lead.name} · {lead.phone}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-faint hover:bg-white/5 hover:text-ink">
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {loading ?
        <div className="flex items-center justify-center gap-2 py-16 text-[12.5px] text-ink-faint">
            <Loader2Icon className="h-4 w-4 animate-spin" /> Loading composer…
          </div> :
        !preview ?
        <div className="py-10 text-center text-[12.5px] text-ink-faint">Could not load composer.</div> :

        <div className="flex flex-col gap-4 text-[12px]">
            {error &&
          <div className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-3.5 py-2.5 text-red-300">
                <AlertTriangleIcon className="h-4 w-4 shrink-0" /> {error}
              </div>
          }
            {!preview.whatsappConfigured &&
          <div className="flex items-center gap-2 rounded-xl border border-agent-objection/30 bg-agent-objection/10 px-3.5 py-2.5 text-agent-objection">
                <AlertTriangleIcon className="h-4 w-4 shrink-0" /> WhatsApp isn't configured on the backend yet.
              </div>
          }

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Property / Project</label>
              <select
              value={project}
              onChange={(e) => { setProject(e.target.value); loadPreview(e.target.value); }}
              className="rounded-lg border border-line bg-white/[0.04] px-3 py-2 text-ink focus:border-agent-intent/50 focus:outline-none">

                <option value="">— No project selected —</option>
                {preview.availableProjects.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">What to send</label>
              <div className="grid grid-cols-2 gap-2">
                <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${sendMessage ? 'border-agent-sentiment/40 bg-agent-sentiment/10 text-ink' : 'border-line text-ink-muted'}`}>
                  <input type="checkbox" checked={sendMessage} onChange={(e) => setSendMessage(e.target.checked)} className="accent-agent-sentiment" />
                  <MessageSquareIcon className="h-3.5 w-3.5" /> Message
                </label>
                <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${!preview.brochureAvailable ? 'cursor-not-allowed border-line text-ink-faint opacity-50' : sendBrochure ? 'border-agent-sentiment/40 bg-agent-sentiment/10 text-ink' : 'border-line text-ink-muted'}`}>
                  <input type="checkbox" disabled={!preview.brochureAvailable} checked={sendBrochure} onChange={(e) => setSendBrochure(e.target.checked)} className="accent-agent-sentiment" />
                  <FileTextIcon className="h-3.5 w-3.5" /> Brochure{!preview.brochureAvailable ? ' (none)' : ''}
                </label>
                <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${!preview.locationAvailable ? 'cursor-not-allowed border-line text-ink-faint opacity-50' : sendLocation ? 'border-agent-sentiment/40 bg-agent-sentiment/10 text-ink' : 'border-line text-ink-muted'}`}>
                  <input type="checkbox" disabled={!preview.locationAvailable} checked={sendLocation} onChange={(e) => setSendLocation(e.target.checked)} className="accent-agent-sentiment" />
                  <MapPinIcon className="h-3.5 w-3.5" /> Location pin{!preview.locationAvailable ? ' (not set)' : ''}
                </label>
                <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${!preview.mapsLink ? 'cursor-not-allowed border-line text-ink-faint opacity-50' : sendMapsLink ? 'border-agent-sentiment/40 bg-agent-sentiment/10 text-ink' : 'border-line text-ink-muted'}`}>
                  <input type="checkbox" disabled={!preview.mapsLink} checked={sendMapsLink} onChange={(e) => setSendMapsLink(e.target.checked)} className="accent-agent-sentiment" />
                  <Link2Icon className="h-3.5 w-3.5" /> Maps link{!preview.mapsLink ? ' (not set)' : ''}
                </label>
                <label className={`col-span-2 flex items-center gap-2 rounded-lg border px-3 py-2 ${preview.images.length === 0 ? 'cursor-not-allowed border-line text-ink-faint opacity-50' : sendImages ? 'border-agent-sentiment/40 bg-agent-sentiment/10 text-ink' : 'border-line text-ink-muted'}`}>
                  <input type="checkbox" disabled={preview.images.length === 0} checked={sendImages} onChange={(e) => setSendImages(e.target.checked)} className="accent-agent-sentiment" />
                  <ImageIcon className="h-3.5 w-3.5" /> Property photos{preview.images.length > 0 ? ` (${preview.images.length})` : ' (none)'}
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Message preview (editable)</label>
              <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={!sendMessage}
              rows={7}
              className="resize-none rounded-lg border border-line bg-white/[0.04] px-3 py-2 leading-relaxed text-ink focus:border-agent-intent/50 focus:outline-none disabled:opacity-50" />

            </div>

            {results &&
          <div className="flex flex-col gap-1.5 border-t border-line pt-3">
                {results.map((r, i) =>
            <div key={i} className={`flex items-center gap-2 text-[11px] ${r.ok ? 'text-agent-sentiment' : 'text-red-400'}`}>
                    {r.ok ? <CheckCircle2Icon className="h-3.5 w-3.5 shrink-0" /> : <XCircleIcon className="h-3.5 w-3.5 shrink-0" />}
                    <span className="font-semibold capitalize">{r.type.replace('_', ' ')}:</span>
                    <span>{r.ok ? 'Sent' : r.error}</span>
                  </div>
            )}
              </div>
          }

            <button
            type="button"
            onClick={handleSend}
            disabled={sending || !preview.phoneValid || !preview.whatsappConfigured || nothingSelected}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-agent-sentiment py-2.5 font-semibold uppercase tracking-wide text-void transition-opacity disabled:opacity-40">

              {sending ? <><Loader2Icon className="h-4 w-4 animate-spin" /> Sending…</> : <><SendIcon className="h-4 w-4" /> Send WhatsApp</>}
            </button>
          </div>
        }
      </div>
    </div>);

}
