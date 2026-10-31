import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRightIcon, CheckIcon, ClockIcon, ShieldAlertIcon } from 'lucide-react';
import type { Agent, StageModule } from '../../types/agent';
import { emotionTimeline, leadById, liveTranscript, teamDecision } from '../../data/demo';
import { Eyebrow } from '../ui/Panel';
import type { RealCrmStats } from '../../hooks/useRealCrmStats';

const rahul = leadById('rahul-sharma');

function Card({
  title,
  children,
  index = 0,
  accent





}: {title: string;children: React.ReactNode;index?: number;accent: string;}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, delay: Math.min(index, 4) * 0.05, ease: [0.23, 1, 0.32, 1] }}
      className="glass rounded-2xl p-4"
      style={{ boxShadow: `inset 0 1px 0 ${accent}18` }}>
      
      <Eyebrow className="mb-3 block">{title}</Eyebrow>
      {children}
    </motion.div>);

}

function Bar({ value, accent, label, display }: {value: number;accent: string;label: string;display: string;}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
        <span className="text-ink-muted">{label}</span>
        <span className="font-medium text-ink">{display}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/[0.07]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: accent }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }} />
        
      </div>
    </div>);

}

interface StageModulesProps {
  agent: Agent;
  revealed: StageModule[];
  realStats?: RealCrmStats;
}

export function StageModules({ agent, revealed, realStats }: StageModulesProps) {
  const accent = agent.accent;
  let i = -1;
  const next = () => i += 1;
  const mine = realStats?.byPersona[agent.id];
  const realMetrics = [
  { label: 'Assigned Leads', value: mine?.assigned ?? 0 },
  { label: 'Contacted', value: mine?.contacted ?? 0 },
  { label: 'Hot / Interested', value: mine?.hot ?? 0 },
  { label: 'Completed', value: mine?.completed ?? 0 }];


  return (
    <div className="grid gap-3">
      {revealed.includes('metrics') &&
      <Card title={`${agent.name} · real workload`} index={next()} accent={accent}>
          <div className="grid grid-cols-2 gap-3">
            {realMetrics.map((m) =>
          <div key={m.label}>
                <p className="font-serif text-2xl leading-none text-ink">{m.value}</p>
                <p className="mt-1 text-[11px] text-ink-muted">{m.label}</p>
              </div>
          )}
          </div>
        </Card>
      }

      {revealed.includes('intentBreakdown') &&
      <Card title="Buying intent · Rahul Sharma" index={next()} accent={accent}>
          <div className="mb-4 flex items-end gap-3">
            <span className="font-serif text-5xl leading-none" style={{ color: accent }}>
              91%
            </span>
            <span className="pb-1 text-[12px] text-ink-muted">Investment · 92% confidence</span>
          </div>
          <Bar value={92} accent={accent} label="Investment" display="92%" />
          <Bar value={74} accent={accent} label="Urgency" display="74%" />
          <Bar value={61} accent={accent} label="Price sensitivity" display="61%" />
          <div className="mt-3 flex gap-2 text-[11px] text-ink-muted">
            <span className="rounded-full border border-line px-2 py-1">Location · Devanahalli</span>
            <span className="rounded-full border border-line px-2 py-1">Budget · ₹30L – ₹50L</span>
          </div>
        </Card>
      }

      {revealed.includes('signalFlow') &&
      <Card title="How intent is calculated" index={next()} accent={accent}>
          <ol className="space-y-2">
            {['Conversation', 'Context', 'Customer behaviour', 'Historical memory', 'Buying signals', 'Intent score'].map(
            (step, idx, arr) =>
            <li key={step} className="flex items-center gap-3">
                  <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.08, duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px]"
                style={{ background: `${accent}1f`, color: accent }}>
                
                    {String(idx + 1).padStart(2, '0')}
                  </motion.span>
                  <span
                className={
                idx === arr.length - 1 ? 'text-[13px] font-medium text-ink' : 'text-[13px] text-ink-muted'
                }>
                
                    {step}
                  </span>
                </li>

          )}
          </ol>
        </Card>
      }

      {revealed.includes('sentiment') &&
      <Card title="Customer sentiment" index={next()} accent={accent}>
          <div className="mb-4 flex items-end gap-3">
            <span className="font-serif text-5xl leading-none" style={{ color: accent }}>
              92%
            </span>
            <span className="pb-1 text-[12px] text-ink-muted">Positive · interest high</span>
          </div>
          <Bar value={88} accent={accent} label="Confidence" display="88%" />
          <Bar value={22} accent={accent} label="Hesitation" display="Low" />
          <Bar value={12} accent={accent} label="Frustration" display="12%" />
        </Card>
      }

      {revealed.includes('emotionTimeline') &&
      <Card title="Emotion timeline" index={next()} accent={accent}>
          <div className="space-y-2.5">
            {emotionTimeline.map((e, idx) =>
          <motion.div
            key={e.time}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.07, duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
            className="flex items-center gap-3">
            
                <span className="w-11 text-[11px] tabular-nums text-ink-faint">{e.time}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <span className="block h-full rounded-full" style={{ width: `${e.value}%`, background: e.tone }} />
                </span>
                <span className="w-28 text-right text-[11px] text-ink-muted">{e.label}</span>
              </motion.div>
          )}
          </div>
        </Card>
      }

      {revealed.includes('objection') &&
      <Card title="Detected objection" index={next()} accent={accent}>
          <p className="font-serif text-xl italic text-ink">“Price is slightly high.”</p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-[11px]">
            <div>
              <p className="text-ink-faint">Type</p>
              <p className="text-ink">Price sensitivity</p>
            </div>
            <div>
              <p className="text-ink-faint">Severity</p>
              <p className="text-ink">Medium</p>
            </div>
            <div>
              <p className="text-ink-faint">Confidence</p>
              <p style={{ color: accent }}>88%</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-line bg-white/[0.02] p-3">
            <Eyebrow>Recommended strategy</Eyebrow>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink">
              Lead with location value and appreciation potential before discussing discounts.
            </p>
          </div>
        </Card>
      }

      {revealed.includes('memory') &&
      <Card title="Customer memory" index={next()} accent={accent}>
          <p className="text-[15px] font-medium text-ink">{rahul.name}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12px]">
            {[
          ['Last contact', rahul.lastContact],
          ['Previous employee', rahul.previousEmployee],
          ['Interest', 'Investment plot'],
          ['Location', rahul.location],
          ['Budget', rahul.budget],
          ['Previous objection', rahul.objection],
          ['Last site visit', rahul.siteVisit],
          ['Next follow-up', rahul.nextFollowUp]].
          map(([k, v]) =>
          <div key={k}>
                <dt className="text-ink-faint">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
          )}
          </dl>
        </Card>
      }

      {revealed.includes('actionQueue') &&
      <Card title="Ready to execute" index={next()} accent={accent}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-medium text-ink">{rahul.name}</p>
              <p className="text-[12px] text-ink-muted">Buying intent 91% · price objection open</p>
            </div>
            <span className="rounded-full px-2.5 py-1 text-[11px]" style={{ background: `${accent}1f`, color: accent }}>
              Follow-up call
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-white/[0.02] p-3 text-[12px] text-ink">
            <ClockIcon className="h-4 w-4" style={{ color: accent }} />
            Tomorrow · 11:30 AM · owner Arjun
          </div>
        </Card>
      }

      {revealed.includes('transcript') &&
      <Card title="Live transcript" index={next()} accent={accent}>
          <div className="space-y-2.5">
            {liveTranscript.map((t) =>
          <div key={t.at} className="text-[12px]">
                <p className="text-ink-faint">
                  {t.speaker} · {t.at}
                </p>
                <p className="text-ink">{t.text}</p>
              </div>
          )}
          </div>
        </Card>
      }

      {revealed.includes('teamDecision') &&
      <Card title="AIVA team decision" index={next()} accent={accent}>
          <dl className="grid gap-2 text-[12px]">
            {[
          ['Lead', teamDecision.lead],
          ['Intent', teamDecision.intent],
          ['Sentiment', teamDecision.sentiment],
          ['Objection', teamDecision.objection],
          ['Memory', teamDecision.memory],
          ['Recommendation', teamDecision.recommendation]].
          map(([k, v]) =>
          <div key={k} className="flex items-baseline justify-between gap-4 border-b border-line pb-2 last:border-0">
                <dt className="text-ink-faint">{k}</dt>
                <dd className="text-right text-ink">{v}</dd>
              </div>
          )}
          </dl>
          <div
          className="mt-3 flex items-center gap-2 rounded-xl p-3 text-[12px] text-ink"
          style={{ background: `${accent}14` }}>
          
            <CheckIcon className="h-4 w-4" style={{ color: accent }} />
            {teamDecision.nextAction}
          </div>
        </Card>
      }
    </div>);

}

export function ConfirmationCard({
  accent,
  prompt,
  onConfirm,
  onCancel





}: {accent: string;prompt: string;onConfirm: () => void;onCancel: () => void;}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
      className="glass rounded-2xl p-4"
      style={{ boxShadow: `0 0 0 1px ${accent}55` }}
      role="alertdialog"
      aria-label="Confirm action">
      
      <div className="flex items-start gap-3">
        <ShieldAlertIcon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
        <div className="flex-1">
          <Eyebrow>Confirmation required</Eyebrow>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink">{prompt}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-void transition-transform duration-150 ease-cinema active:scale-[0.98]"
              style={{ background: accent }}>
              
              Confirm
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-line px-3 py-1.5 text-[12px] text-ink-muted transition-colors duration-150 ease-cinema hover:text-ink">
              
              Cancel
            </button>
          </div>
        </div>
        <ArrowRightIcon className="hidden h-4 w-4 text-ink-faint" aria-hidden />
      </div>
    </motion.div>);

}