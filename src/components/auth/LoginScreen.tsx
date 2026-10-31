import React, { useRef, useState } from 'react';
import { EyeIcon, EyeOffIcon, LockIcon, UserIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const TILT_MAX_DEG = 8;

export function LoginScreen() {
  const { login, error } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const cardRef = useRef<HTMLFormElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const onCardMouseMove = (e: React.MouseEvent<HTMLFormElement>) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5; // -0.5..0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ rx: -py * TILT_MAX_DEG * 2, ry: px * TILT_MAX_DEG * 2 });
  };

  const onCardMouseLeave = () => {
    setIsHovering(false);
    setTilt({ rx: 0, ry: 0 });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(username, password, remember);
    } catch {
      // error is surfaced via useAuth().error
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-void px-4 md:justify-end md:px-[6vw]">
      <video
        autoPlay
        loop
        muted
        playsInline
        poster="/brand/login-bg.jpg"
        onLoadedMetadata={(e) => {
          e.currentTarget.playbackRate = 0.25;
        }}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: 'left center' }}>

        <source src="/brand/login-bg.mp4" type="video/mp4" />
      </video>

      <form
        ref={cardRef}
        onSubmit={onSubmit}
        onMouseEnter={() => setIsHovering(true)}
        onMouseMove={onCardMouseMove}
        onMouseLeave={onCardMouseLeave}
        className="glass-premium relative w-full max-w-[480px] overflow-hidden p-10"
        style={{
          transform: `perspective(1200px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale3d(${isHovering ? 1.02 : 1}, ${isHovering ? 1.02 : 1}, 1)`,
          transition: isHovering ? 'transform 0.06s linear' : 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
          transformStyle: 'preserve-3d',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.25), inset 0 0 60px rgba(255,255,255,0.03), 0 0 0 1px rgba(255,255,255,0.06), -30px -30px 90px -60px rgba(96,165,250,0.6), 30px 30px 90px -60px rgba(251,191,36,0.5), 0 40px 100px -30px rgba(0,0,0,0.9)'
        }}>

        {/* glassmorphism light sheen — a soft diagonal highlight across the top, like light catching real glass */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 22%, transparent 45%)'
          }} />

        <div
          aria-hidden
          className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(147,197,253,0.5), transparent 70%)' }} />

        <div className="flex flex-col items-center text-center">
          <img src="/brand/aiva-emblem.png" alt="AIVA" className="h-16 w-16 object-contain" />
          <p
            className="mt-2 font-sans text-[28px] font-bold uppercase tracking-[0.12em]"
            style={{
              backgroundImage: 'linear-gradient(100deg, #93c5fd 0%, #f5e6c8 45%, #fbbf24 65%, #93c5fd 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              WebkitTextFillColor: 'transparent'
            }}>

            AIVA
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-ink-faint/60" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-ink-faint">AI Sales Workforce</span>
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-ink-faint/60" />
          </div>
        </div>

        <h2 className="mt-7 text-center text-[26px] font-semibold text-ink">Welcome Back</h2>
        <p className="mt-1.5 text-center text-[13.5px] text-ink-muted">Sign in to your AIVA account.</p>

        <label className="mt-7 block text-[12px] text-ink-faint">Username</label>
        <div className="relative mt-1.5">
          <UserIcon className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-faint" />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            placeholder="Username"
            className="w-full rounded-xl border border-white/15 bg-white/[0.06] py-3.5 pl-12 pr-4 text-[14.5px] text-ink placeholder:text-ink-faint focus:border-agent-intent/50 focus:outline-none" />

        </div>

        <label className="mt-4 block text-[12px] text-ink-faint">Password</label>
        <div className="relative mt-1.5">
          <LockIcon className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-faint" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="Password"
            className="w-full rounded-xl border border-white/15 bg-white/[0.06] py-3.5 pl-12 pr-12 text-[14.5px] text-ink placeholder:text-ink-faint focus:border-agent-intent/50 focus:outline-none" />

          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-faint transition-colors duration-150 hover:text-ink">

            {showPassword ? <EyeOffIcon className="h-[18px] w-[18px]" /> : <EyeIcon className="h-[18px] w-[18px]" />}
          </button>
        </div>

        <label className="mt-5 flex items-center gap-2.5 text-[13px] text-ink-muted">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border-line accent-agent-intent" />

          Remember me on this device
        </label>

        {error && <p className="mt-3 text-[13px] text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-xl py-3.5 text-[14.5px] font-semibold text-void transition-opacity duration-150 disabled:opacity-50"
          style={{
            backgroundImage: 'linear-gradient(90deg, #60a5fa, #a78bfa 50%, #fbbf24)',
            boxShadow: '0 8px 24px -10px rgba(96,165,250,0.6)'
          }}>

          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>);

}
