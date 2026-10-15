import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowDownLeft, ArrowRight, ArrowUpRight, Check, CheckCheck, CheckCircle2, ChevronRight, Circle, CircleAlert, Code2, Download, ExternalLink, FileText, Headphones, Keyboard, Loader2, Menu, Play, Plus, Radio, RotateCcw, ScanLine, ShieldCheck, ShoppingBag, Sparkles, Utensils, Volume2, X } from 'lucide-react';
import type { Finding, Fix, Journey, Run, Step } from '../../runner/src/types';

type FixPreview = { diff: string; fixes: Fix[] };
const journeyNames: Record<Journey, string> = { add_to_cart: 'Add a product to cart', find_menu: 'Find the restaurant menu' };
const terminalStatuses = new Set(['stuck', 'passed', 'error']);

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(result.message || result.error || 'Something went wrong. Please try again.');
  return result as T;
}
const post = <T,>(path: string, body: unknown = {}) => api<T>(path, { method: 'POST', body: JSON.stringify(body) });
const date = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const siteLabel = (value: string) => { try { return new URL(value).hostname; } catch { return value; } };
const isDemoUrl = (value: string) => value === 'demo' || /\/demo-store(?:-fixed)?(?:\/|$)/.test(value);

function Brand({ footer = false }: { footer?: boolean }) {
  return <Link className={`brand ${footer ? 'brand-footer' : ''}`} to="/" aria-label="Journeyproof home"><span className="brand-symbol" aria-hidden="true"><span /><span /><span /></span>journeyproof<span className="brand-dot">.</span></Link>;
}

function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [location.pathname]);
  return <header className="site-header"><div className="header-inner"><Brand /><nav className={open ? 'main-nav nav-open' : 'main-nav'} aria-label="Main navigation"><NavLink to="/" end>Journey checker</NavLink><Link to="/#how-it-works">How it works</Link><NavLink to="/pricing">Pricing</NavLink></nav><div className="header-right"><span className="event-badge"><span />NEXT FOUNDERS <span className="badge-slash">/</span> 2026</span><button className="mobile-menu icon-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? 'Close navigation' : 'Open navigation'}>{open ? <X size={22} /> : <Menu size={22} />}</button></div></div></header>;
}

function Footer() {
  return <footer className="site-footer"><div className="footer-top"><Brand footer /><p>Every journey deserves an open door.</p><a className="back-top" href="#top">Back to top <ArrowUpRight size={15} /></a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Journeyproof</span><span>Built for real people. Tested with real journeys.</span><span className="footer-status"><span /> SYSTEM READY</span></div></footer>;
}

function Button({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) { return <button className={`button ${className}`} {...props}>{children}</button>; }
function ErrorNote({ children }: { children: ReactNode }) { return <div className="error-note" role="alert"><CircleAlert size={17} /><span>{children}</span></div>; }
function Badge({ status }: { status: Run['status'] }) { return <span className={`status-badge status-${status}`}><span />{status === 'passed' ? 'Journey passed' : status === 'stuck' ? 'Barrier found' : status === 'running' ? 'Running journey' : status === 'queued' ? 'In the queue' : 'Run stopped'}</span>; }

function JourneyPicker({ value, onChange }: { value: Journey; onChange: (j: Journey) => void }) {
  return <fieldset className="journey-picker"><legend>Choose a customer journey</legend><div className="journey-options"><label className={value === 'add_to_cart' ? 'journey-choice selected' : 'journey-choice'}><input type="radio" name="journey" value="add_to_cart" checked={value === 'add_to_cart'} onChange={() => onChange('add_to_cart')} /><ShoppingBag size={18} /><span><strong>Online store</strong><small>Add to cart</small></span><span className="radio-indicator">{value === 'add_to_cart' && <Circle size={7} fill="currentColor" />}</span></label><label className={value === 'find_menu' ? 'journey-choice selected' : 'journey-choice'}><input type="radio" name="journey" value="find_menu" checked={value === 'find_menu'} onChange={() => onChange('find_menu')} /><Utensils size={18} /><span><strong>Restaurant</strong><small>Find the menu</small></span><span className="radio-indicator">{value === 'find_menu' && <Circle size={7} fill="currentColor" />}</span></label></div></fieldset>;
}

function Home() {
  const [url, setUrl] = useState('');
  const [journey, setJourney] = useState<Journey>('add_to_cart');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [runs, setRuns] = useState<Run[]>([]);
  const navigate = useNavigate();
  useEffect(() => { api<Run[]>('/api/runs').then(setRuns).catch(() => {}); }, []);
  useEffect(() => { if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView(); }, []);
  async function start(demo = false) {
    setBusy(true); setError('');
    try {
      const result = await post<Run | { runId: string }>('/api/runs', { url: demo ? 'demo' : url, journey: demo ? 'add_to_cart' : journey });
      navigate(`/runs/${'runId' in result ? result.runId : result.id}`);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  function submit(e: FormEvent) { e.preventDefault(); void start(); }
  return <>
    <main id="main-content">
      <section className="hero page-width">
        <div className="hero-copy"><div className="eyebrow"><span className="tiny-star">✳</span> AUTOMATED ACCESSIBILITY JOURNEY TESTING</div><h1>Can everyone<br />finish the<br /><span className="journey-word">journey<span className="word-arrow" aria-hidden="true">↗</span></span>?</h1><p className="hero-description">Your site looks great. Let’s find out how it <em>works</em>.<br className="desktop-break" /> We test it with a keyboard and virtual screen reader, find<br className="desktop-break" /> the barriers, and prove the fix.</p><div className="hero-proof"><span className="proof-icon"><Keyboard size={17} /></span><span>Real journeys. Real barriers. Dated evidence.</span></div></div>
        <div className="checker-area"><div className="handwritten-note">A better experience starts here <ArrowDownLeft size={30} strokeWidth={1.2} /></div><div className="checker-card"><div className="checker-heading"><span className="checker-icon"><ScanLine size={21} /></span><span>Let’s try your front door.</span><span className="free-pill">FREE CHECK</span></div><form onSubmit={submit}><label className="field-label" htmlFor="website">Your website</label><div className="url-input"><span aria-hidden="true">↗</span><input id="website" name="url" type="url" placeholder="https://your-website.com" required value={url} onChange={e => setUrl(e.target.value)} autoComplete="url" /></div><JourneyPicker value={journey} onChange={setJourney} /><Button className="button-lime full-width" type="submit" disabled={busy}>{busy ? <><Loader2 className="spin" size={18} /> Starting journey…</> : <>Run journey <ArrowRight size={19} /></>}</Button>{error && <ErrorNote>{error}</ErrorNote>}<p className="checker-footnote"><ShieldCheck size={14} /> No payment. No forms submitted. Just the journey.</p></form><div className="demo-invite"><span>Want to see it in action?</span><button onClick={() => void start(true)} disabled={busy}>Run the demo <ArrowUpRight size={15} /></button></div></div><div className="checker-caption"><span className="caption-line" /> MADE FOR THE PEOPLE ON THE OTHER SIDE OF YOUR SCREEN</div></div>
      </section>
      <section className="insight-strip page-width" aria-label="Why this matters"><div className="insight-number">95.9<span>%</span><span className="stat-asterisk">*</span></div><div className="insight-copy"><p>of the top million home pages had<br /><strong>detected WCAG failures.</strong></p><a href="https://webaim.org/projects/million/" target="_blank" rel="noreferrer">WebAIM Million, 2026 <ArrowUpRight size={12} /></a></div><div className="insight-divider" /><p className="insight-question">A beautiful website is only the beginning.<br /><strong>Getting through it is what matters.</strong></p><span className="insight-art" aria-hidden="true">↳</span></section>
      <section className="how-section page-width" id="how-it-works"><div className="section-heading"><div><div className="eyebrow">THE WHOLE JOURNEY, NOT JUST A SCORE</div><h2>From “looks good”<br />to <span className="serif-italic">works for everyone.</span></h2></div><p>We follow the same steps your customers do.<br />Then turn every roadblock into a way forward.</p></div><div className="process-grid">{[
        { n: '01', icon: <Keyboard />, title: 'Walk the journey', text: 'Navigate with a keyboard and screen reader announcements. No mouse shortcuts.', label: 'TEST', color: 'paper' },
        { n: '02', icon: <ScanLine />, title: 'Find the roadblock', text: 'See exactly where the journey stops, with the announcement and element behind it.', label: 'DIAGNOSE', color: 'paper' },
        { n: '03', icon: <Code2 />, title: 'Make a real fix', text: 'Review a focused code change. You approve proposed labels and image descriptions.', label: 'FIX', color: 'paper' },
        { n: '04', icon: <CheckCheck />, title: 'Prove the way through', text: 'Run the same journey again. Keep the before, after, and dated evidence together.', label: 'RE-TEST', color: 'green' },
      ].map(item => <article className={`process-card process-${item.color}`} key={item.n}><div className="process-top"><span>{item.n}</span>{item.icon}</div><div className="process-bottom"><span className="process-label">{item.label}</span><h3>{item.title}</h3><p>{item.text}</p></div></article>)}</div></section>
      <section className="feature-section page-width"><div className="feature-copy"><div className="eyebrow"><span className="live-dot" /> A HUMAN PERSPECTIVE</div><h2>Hear the barrier.<br /><span className="serif-italic">Understand the impact.</span></h2><p>A missing name isn’t just a line in a report. It’s a customer hearing “button” and wondering what happens next.</p><p>Follow every announcement as it happens. See what changed. Keep the evidence that your tested journey works.</p><Link className="text-link" to="/pricing">Small business. Open doors. <ArrowUpRight size={17} /></Link></div><div className="announcement-illustration" aria-label="Illustration of an accessible announcement"><div className="illustration-top"><span className="window-dots"><i /><i /><i /></span><span>THE DIFFERENCE A NAME MAKES</span><Headphones size={16} /></div><div className="announcement-before"><span className="annotation-label">BEFORE</span><div><Volume2 size={20} /><span>“button”</span><CircleAlert size={16} /></div><p>What does this button do?</p></div><div className="illustration-connector"><span /><ArrowDown size={18} /><span /></div><div className="announcement-after"><span className="annotation-label">AFTER</span><div><Volume2 size={20} /><span>“Add to cart, button”</span><Check size={18} /></div><p>A little clarity. A whole way forward.</p></div><span className="illustration-note">Illustrative announcement · your run streams actual results</span></div></section>
      <section className="history-section page-width"><div className="section-heading compact-heading"><div><div className="eyebrow">YOUR EVIDENCE, IN ONE PLACE</div><h2>Recent journeys<span className="heading-dot">.</span></h2></div><span className="history-count">{runs.length ? `${runs.length} recorded ${runs.length === 1 ? 'journey' : 'journeys'}` : 'Your first journey starts above'}</span></div>{runs.length ? <div className="run-list">{runs.slice(0, 5).map(run => <Link key={run.id} to={`/runs/${run.id}`} className="run-row"><span className="run-row-icon">{run.journey === 'find_menu' ? <Utensils size={19} /> : <ShoppingBag size={19} />}</span><span className="run-row-title"><strong>{siteLabel(run.url)}</strong><small>{journeyNames[run.journey]}</small></span><span className="run-row-date">{date(run.createdAt)}</span><Badge status={run.status} /><ArrowUpRight size={18} /></Link>)}</div> : <div className="empty-history"><span className="empty-history-icon"><FileText size={24} strokeWidth={1.4} /></span><div><h3>A fresh start. An open possibility.</h3><p>Your journey results and evidence will appear here after your first run.</p></div><a href="#top" className="text-link">Try your first journey <ArrowUpRight size={16} /></a></div>}</section>
      <section className="closing-note page-width"><span className="closing-star" aria-hidden="true">✳</span><p>The internet should be<br /><span className="serif-italic">a place everyone can go.</span></p><a href="#top" className="round-arrow" aria-label="Start a journey"><ArrowUpRight size={29} strokeWidth={1.3} /></a></section>
    </main><Footer />
  </>;
}

function useRun(id: string | undefined, stream = true) {
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => { if (!id) return; try { setRun(await api<Run>(`/api/runs/${id}`)); setError(''); } catch (e) { setError((e as Error).message); } }, [id]);
  useEffect(() => { setRun(null); void refresh(); }, [refresh]);
  useEffect(() => {
    if (!id || !stream || (run && terminalStatuses.has(run.status))) return;
    const events = new EventSource(`/api/runs/${id}/events`);
    const listener = () => void refresh();
    for (const type of ['status', 'step', 'finding', 'complete', 'error']) events.addEventListener(type, listener);
    const interval = window.setInterval(listener, 3500);
    return () => { events.close(); window.clearInterval(interval); };
  }, [id, stream, run?.status, refresh]);
  return { run, error, refresh };
}

function PageIntro({ eyebrow, title, children, action }: { eyebrow: string; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return <div className="page-intro"><div><Link className="breadcrumb" to="/">Journey checker <ChevronRight size={12} /></Link><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{children}</div>{action && <div className="intro-action">{action}</div>}</div>;
}

function LoadingPage() { return <main id="main-content" className="page-width loading-page"><Loader2 className="spin" size={28} /><p>Opening your journey…</p></main>; }
function LoadingError({ message }: { message: string }) { return <main id="main-content" className="page-width loading-page"><CircleAlert size={30} /><h1>We couldn’t open this journey.</h1><p>{message}</p><Link className="button button-dark" to="/">Back to journey checker <ArrowRight size={17} /></Link></main>; }

function Timeline({ run }: { run: Run }) {
  if (run.mode === 'replay') return <div className="replay-timeline"><RotateCcw size={19} /><div><strong>Replaying the recorded journey</strong><span>Saved actions + announcements · no model or browser requests</span></div><span className="replay-label">OFFLINE REPLAY</span></div>;
  const phase = run.parentId ? (run.status === 'passed' ? 4 : 3) : run.status === 'stuck' ? 1 : 0;
  return <div className="run-timeline" aria-label="Journey progress">{[{ name: 'Test the journey', icon: <Keyboard size={18} /> }, { name: 'Diagnose barriers', icon: <ScanLine size={18} /> }, { name: 'Review the fix', icon: <Code2 size={18} /> }, { name: 'Re-test & prove', icon: <ShieldCheck size={18} /> }].map((item, index) => <div key={item.name} className={`timeline-item ${index < phase ? 'phase-done' : ''} ${index === phase ? 'phase-current' : ''}`}><span className="timeline-icon">{index < phase ? <Check size={18} /> : item.icon}</span><span><small>0{index + 1}</small>{item.name}</span>{index < 3 && <ChevronRight className="timeline-chevron" size={17} />}</div>)}</div>;
}

function Transcript({ run, compact = false }: { run: Run; compact?: boolean }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  useEffect(() => { if (follow && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight; }, [run.steps.length, follow]);
  return <section className={`transcript-panel ${compact ? 'transcript-compact' : ''}`} aria-label="Screen reader transcript"><div className="transcript-heading"><div><Headphones size={18} /><span>Screen reader transcript</span></div><span className="transcript-live"><span className={run.status === 'running' ? 'pulse-dot' : ''} />{run.mode === 'replay' ? 'REPLAY' : run.status === 'running' ? 'LIVE' : 'RECORDED'}</span></div><div className="transcript-metadata"><span><Keyboard size={13} /> KEYBOARD NAVIGATION</span><span>{run.announcer || 'Accessible name + role'}</span></div><div ref={viewport} className="transcript-body" tabIndex={0} aria-label="Scrollable transcript">{run.steps.length ? run.steps.map((step, index) => <div className={`transcript-step ${index === run.steps.length - 1 ? 'latest-step' : ''}`} key={`${step.index}-${index}`}><span className="step-number">{String(step.index).padStart(2, '0')}</span><div><div className="step-action"><span>{step.action.type}{step.action.type === 'type' ? ` “${step.action.text ?? ''}”` : step.action.type === 'jump' ? ` ${step.action.index}` : ''}</span><time dateTime={step.timestamp}>{new Date(step.timestamp).toLocaleTimeString(undefined, { hour12: false })}</time></div><p><span className="announcement-marker">↳</span> {step.announcement || 'No announcement recorded'}</p>{step.action.reason && <span className="step-reason">{step.action.reason}</span>}</div></div>) : <div className="transcript-waiting"><span className="terminal-cursor" /><p>{run.status === 'error' ? 'The run stopped before announcements were recorded.' : 'Waiting for the first announcement…'}</p></div>}{run.status === 'running' && run.steps.length > 0 && <div className="transcript-listening"><span className="terminal-cursor" /> Listening for the next step</div>}</div><div className="transcript-bottom"><span>{run.steps.length} {run.steps.length === 1 ? 'step' : 'steps'} recorded <span>·</span> No mouse actions</span><button onClick={() => setFollow(!follow)} aria-pressed={follow}>{follow ? <Check size={12} /> : <Plus size={12} />} Auto-follow {follow ? 'on' : 'off'}</button></div></section>;
}

function FindingCard({ finding }: { finding: Finding }) { return <article className="finding-card"><div className="finding-top"><span className={`impact impact-${finding.impact}`}>{finding.impact}</span><span className="rule-name">{finding.rule}</span></div><h3>{finding.description}</h3><code>{finding.selector}</code>{finding.helpUrl && <a href={finding.helpUrl} target="_blank" rel="noreferrer">About this barrier <ExternalLink size={12} /></a>}</article>; }

function ResultSummary({ run }: { run: Run }) {
  return <div className={`result-summary result-${run.status}`}><span className="result-symbol">{run.status === 'passed' ? <CheckCheck size={24} /> : run.status === 'stuck' ? <CircleAlert size={24} /> : run.status === 'error' ? <CircleAlert size={24} /> : <Radio className="pulse" size={24} />}</span><div><h2>{run.mode === 'replay' ? 'Playing back a recorded journey outcome.' : run.status === 'passed' ? 'The tested journey reaches its destination.' : run.status === 'stuck' ? 'There’s a roadblock in this journey.' : run.status === 'error' ? 'This journey stopped early.' : 'Following your customer’s next step.'}</h2><p>{run.reason || (run.status === 'passed' ? 'The deterministic success check passed. Review the recorded steps and evidence below.' : run.status === 'stuck' ? 'Review the diagnosis and proposed changes below.' : run.status === 'error' ? 'The runner could not finish. You can start a new journey or review the evidence collected so far.' : 'Announcements appear below as the runner navigates your site.')}</p></div></div>;
}

function FixReview({ run }: { run: Run }) {
  const [preview, setPreview] = useState<FixPreview | null>(null);
  const [approved, setApproved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    api<FixPreview>(`/api/runs/${run.id}/fixes`).then(result => { if (active) { setPreview(result); setApproved(result.fixes.filter(f => f.approved).map(f => f.id)); } }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [run.id]);
  const required = preview?.fixes.filter(f => f.requiresApproval) || [];
  const allApproved = required.every(f => approved.includes(f.id));
  async function apply() {
    setBusy(true); setError('');
    try { const next = await post<{ runId: string }>(`/api/runs/${run.id}/fix`, { approvedIds: approved }); navigate(`/runs/${next.runId}`); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return <section className="fix-section"><div className="panel-heading"><div><span className="eyebrow">A WAY FORWARD</span><h2>Small changes. A clearer journey.</h2></div><Code2 size={23} /></div><p className="muted">Review the proposed code changes. Labels and image descriptions need your approval before the fix is applied to the demo copy.</p>{loading && <p className="loading-inline"><Loader2 className="spin" size={16} /> Preparing the fix preview…</p>}{preview && <><div className="fix-list">{preview.fixes.map(fix => <label className={`fix-row ${fix.requiresApproval ? 'fix-needs-approval' : ''}`} key={fix.id}>{fix.requiresApproval ? <input type="checkbox" checked={approved.includes(fix.id)} onChange={e => setApproved(value => e.target.checked ? [...value, fix.id] : value.filter(id => id !== fix.id))} /> : <Check size={19} />}<span><strong>{fix.description}</strong><small>{fix.file} <span>·</span> {fix.requiresApproval ? 'Owner approval required' : 'Deterministic template'}</small></span></label>)}</div>{preview.diff ? <details className="diff-details" open><summary><Code2 size={15} /> Proposed code diff <span>Minimal source changes</span></summary><Diff value={preview.diff} /></details> : <p className="muted">No applicable code changes were generated for this run.</p>}<div className="fix-actions"><span>{allApproved ? <><ShieldCheck size={16} /> Ready to apply to a separate demo copy</> : <><CircleAlert size={16} /> Approve {required.filter(f => !approved.includes(f.id)).length} proposed {required.filter(f => !approved.includes(f.id)).length === 1 ? 'description' : 'descriptions'} above</>}</span><Button className="button-lime" disabled={busy || !allApproved || !preview.fixes.length} onClick={() => void apply()}>{busy ? <><Loader2 className="spin" size={17} /> Applying changes…</> : <>Fix & re-test <ArrowRight size={17} /></>}</Button></div></>}{error && <ErrorNote>{error}</ErrorNote>}</section>;
}

function Diff({ value }: { value: string }) { return <pre className="code-diff" tabIndex={0} aria-label="Unified code diff"><code>{value.split('\n').map((line, index) => <span key={index} className={line.startsWith('+') && !line.startsWith('+++') ? 'diff-add' : line.startsWith('-') && !line.startsWith('---') ? 'diff-remove' : line.startsWith('@@') ? 'diff-location' : ''}>{line || ' '}<br /></span>)}</code></pre>; }

function Screenshot({ run }: { run: Run }) { return run.screenshot ? <section className="screenshot-panel"><div className="panel-heading"><h2>Browser evidence</h2><span className="mini-label">{run.mode === 'replay' ? 'CAPTURED IN SOURCE RECORDING' : 'CAPTURED DURING THIS RUN'}</span></div><a href={run.screenshot} target="_blank" rel="noreferrer"><img src={run.screenshot} alt={`Browser screenshot captured for the ${journeyNames[run.journey].toLowerCase()} journey`} /></a></section> : null; }

function RunPage() {
  const { id } = useParams();
  const { run, error } = useRun(id);
  const [replaying, setReplaying] = useState(false);
  const [actionError, setActionError] = useState('');
  const navigate = useNavigate();
  if (!run) return error ? <LoadingError message={error} /> : <LoadingPage />;
  async function replay() {
    if (!run) return;
    setReplaying(true); setActionError('');
    try { const next = await post<{ runId: string }>(`/api/runs/${run.id}/replay`); navigate(`/runs/${next.runId}`); }
    catch (e) { setActionError((e as Error).message); setReplaying(false); }
  }
  return <><main id="main-content" className="page-width run-page"><PageIntro eyebrow={run.mode === 'replay' ? 'RECORDED JOURNEY · OFFLINE REPLAY' : 'YOUR JOURNEY, AS IT HAPPENS'} title={<>A customer’s-eye view<span className="heading-dot">.</span></>} action={<Badge status={run.status} />}><p className="intro-subtitle"><span>{siteLabel(run.url)}</span><span className="dot-separator">·</span>{journeyNames[run.journey]}</p></PageIntro><Timeline run={run} />{run.mode === 'replay' && <ReplayNotice run={run} />}<ResultSummary run={run} />{actionError && <ErrorNote>{actionError}</ErrorNote>}<div className="live-layout"><div className="live-main"><Transcript run={run} />{run.mode === 'live' && run.status === 'stuck' && isDemoUrl(run.url) && !run.fixedRunId && <FixReview run={run} />}{run.diff && <section className="fix-section"><div className="panel-heading"><h2>The change behind this journey</h2><Code2 size={20} /></div><Diff value={run.diff} /></section>}<Screenshot run={run} /></div><aside className="live-aside"><section className="run-details-panel"><div className="eyebrow">JOURNEY DETAILS</div><dl><div><dt>Journey</dt><dd>{journeyNames[run.journey]}</dd></div><div><dt>Started</dt><dd>{date(run.createdAt)}</dd></div>{run.completedAt && <div><dt>Completed</dt><dd>{date(run.completedAt)}</dd></div>}<div><dt>Navigation</dt><dd><Keyboard size={14} /> Keyboard only</dd></div><div><dt>Steps recorded</dt><dd>{run.steps.length} / 40</dd></div><div><dt>Run ID</dt><dd className="run-id">{run.id}</dd></div></dl></section><section className="findings-panel"><div className="panel-heading"><h2>Diagnosis</h2><span className="count-badge">{run.findings.length}</span></div>{run.findings.length ? run.findings.map(f => <FindingCard finding={f} key={f.id} />) : <div className="no-findings"><ScanLine size={24} strokeWidth={1.3} /><p>{run.status === 'running' || run.status === 'queued' ? 'Barriers will appear here as the journey runs.' : 'No diagnostic findings were recorded for this run.'}</p></div>}</section>{terminalStatuses.has(run.status) && <section className="evidence-actions"><span className="eyebrow">KEEP THE EVIDENCE</span><Link className="button button-dark full-width" to={`/reports/${run.id}`}>View journey report <FileText size={17} /></Link><button className="button button-outline full-width" onClick={() => void replay()} disabled={replaying}>{replaying ? <Loader2 size={16} className="spin" /> : <RotateCcw size={16} />} Replay recorded journey</button><a className="tape-download" href={`/api/runs/${run.id}/tape`} download><Download size={12} /> Download replay tape</a><p>Replay uses saved actions and announcements. No model call needed.</p></section>}{run.fixedRunId && <Link className="fixed-run-link" to={`/runs/${run.fixedRunId}`}><CheckCircle2 size={19} /><span>A re-test is available<strong>Open the fixed journey <ArrowRight size={14} /></strong></span></Link>}{run.parentId && <Link className="parent-run-link" to={`/runs/${run.parentId}`}>{run.mode === 'replay' ? 'View the source recording' : 'View the original journey'} <ArrowUpRight size={14} /></Link>}</aside></div><div className="run-bottom-note"><ShieldCheck size={16} /> Evidence applies to this journey, on this site, at this time. Human testing brings additional perspectives.</div></main><Footer /></>;
}

function AnnouncementEvidence({ run, label }: { run: Run; label: string }) {
  const steps = run.steps.slice(-5);
  return <section className="announcement-evidence"><div className="evidence-title"><span>{label}</span><Badge status={run.status} /></div><p className="evidence-timestamp">{date(run.createdAt)} · {run.steps.length} steps recorded</p>{steps.length ? steps.map((step, index) => <div className="evidence-announcement" key={index}><span>{String(step.index).padStart(2, '0')}</span><p>“{step.announcement || 'No announcement recorded'}”</p></div>) : <p className="muted">No announcements were recorded.</p>}<Link className="text-link" to={`/runs/${run.id}`}>Read the full transcript <ArrowUpRight size={14} /></Link></section>;
}

function ReportPage() {
  const { id } = useParams();
  const { run, error } = useRun(id, false);
  const [related, setRelated] = useState<Run | null>(null);
  useEffect(() => { setRelated(null); const relatedId = run?.parentId || run?.fixedRunId; if (relatedId) api<Run>(`/api/runs/${relatedId}`).then(setRelated).catch(() => {}); }, [run?.parentId, run?.fixedRunId]);
  if (!run) return error ? <LoadingError message={error} /> : <LoadingPage />;
  const before = run.mode === 'replay' ? run : run.parentId ? related : run;
  const after = run.mode === 'replay' ? null : run.parentId ? run : related;
  const evidence = after || run;
  return <><main id="main-content" className="page-width report-page"><PageIntro eyebrow="DATED EVIDENCE · JOURNEY REPORT" title={<>Proof of the journey<span className="heading-dot">.</span></>} action={<div className="report-downloads"><a className="button button-dark" href={`/api/runs/${evidence.id}/report.pdf`} download><Download size={17} /> Download PDF</a><a className="button button-outline" href={`/api/runs/${evidence.id}/report.html`} target="_blank" rel="noreferrer">Open HTML <ExternalLink size={15} /></a></div>}><p className="intro-subtitle">{siteLabel(run.url)}<span className="dot-separator">·</span>{journeyNames[run.journey]}</p></PageIntro><>{run.mode === 'replay' && <ReplayNotice run={run} />}</><ResultSummary run={evidence} /><section className="report-meta"><div><span>WEBSITE</span><strong>{siteLabel(run.url)}</strong></div><div><span>JOURNEY TESTED</span><strong>{journeyNames[run.journey]}</strong></div><div><span>EVIDENCE RECORDED</span><strong>{date(evidence.completedAt || evidence.createdAt)}</strong></div><div><span>METHOD</span><strong>Keyboard + accessibility tree</strong></div></section><section className="report-section"><div className="section-heading compact-heading"><div><div className="eyebrow">THE WORDS ALONG THE WAY</div><h2>{after ? 'Before. After. Evidence.' : 'What the runner heard.'}</h2></div><Headphones size={27} strokeWidth={1.4} /></div><div className={after && before ? 'comparison-grid' : 'single-evidence'}>{before && <AnnouncementEvidence run={before} label={after ? 'ORIGINAL JOURNEY' : 'RECORDED JOURNEY'} />}{after && <AnnouncementEvidence run={after} label="AFTER THE FIX" />}</div>{!after && <p className="report-context">This report contains the recorded journey. A before-and-after comparison appears when a fix has been applied and re-tested.</p>}</section>{(after?.diff || run.diff) && <section className="report-section"><div className="section-heading compact-heading"><div><div className="eyebrow">A FOCUSED CHANGE</div><h2>The source of the fix.</h2></div><Code2 size={26} strokeWidth={1.4} /></div><Diff value={after?.diff || run.diff || ''} /></section>}<div className="report-evidence-grid"><section className="findings-panel"><div className="panel-heading"><h2>Original diagnosis</h2><span className="count-badge">{(before || run).findings.length}</span></div>{(before || run).findings.length ? (before || run).findings.map(f => <FindingCard finding={f} key={f.id} />) : <p className="muted">No diagnostic findings were recorded.</p>}</section><Screenshot run={evidence} /></div><section className="report-meaning"><ShieldCheck size={25} /><div><h3>Evidence with a clear scope.</h3><p>{run.mode === 'replay' ? 'This report replays previously recorded evidence. It is not a fresh website test.' : evidence.status === 'passed' ? 'The journey we tested passed, with dated evidence.' : 'This report records the outcome of the tested journey.'} This is a snapshot of a specific path through your site. Content changes, other journeys, and different assistive technologies can produce different experiences.</p></div></section><Link className="text-link" to={`/runs/${run.id}`}>Return to the complete run <ArrowUpRight size={16} /></Link></main><Footer /></>;
}

function PricingPage() {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [billing, setBilling] = useState<{ active: boolean; plan: string; testMode: boolean } | null>(null);
  const plans = [
    { id: 'free', name: 'A first step', price: '0', tag: 'FREE CHECK', description: 'See your site from a different perspective.', features: ['One journey at a time', 'Live screen reader transcript', 'Barrier diagnosis', 'Dated journey evidence'], button: 'Check a journey', featured: false },
    { id: 'restaurant', name: 'Restaurant', price: '39', tag: 'BRING EVERYONE TO THE TABLE', description: 'Make the path to your menu a welcoming one.', features: ['Menu discovery journeys', 'Proposed code fixes', 'Re-test the same journey', 'Downloadable evidence reports'], button: 'Choose Restaurant', featured: false },
    { id: 'store', name: 'Online store', price: '49', tag: 'THE EVERYDAY ESSENTIAL', description: 'Help every customer get from product to cart.', features: ['Add-to-cart journeys', 'Proposed code fixes', 'Before-and-after evidence', 'Screen reader journey replays'], button: 'Choose Store', featured: true },
    { id: 'agency', name: 'Agency', price: '299', tag: 'MORE SITES. MORE OPEN DOORS.', description: 'Bring journey evidence to your client work.', features: ['Store and restaurant journeys', 'Client-ready evidence reports', 'Source diffs for your developers', 'Recorded journey replays'], button: 'Choose Agency', featured: false },
  ];
  useEffect(() => { const sessionId = new URLSearchParams(window.location.search).get('session_id'); if (sessionId) api<{ active: boolean; plan: string; testMode: boolean }>(`/api/billing/session?session_id=${encodeURIComponent(sessionId)}`).then(setBilling).catch(e => setError(e.message)); }, []);
  async function checkout(plan: string) {
    setBusy(plan); setError('');
    try { const result = await post<{ url: string }>('/api/checkout', { plan }); if (!result.url || !/^https:\/\/checkout\.stripe\.com\//.test(result.url)) throw new Error('Checkout did not return a valid Stripe link. Please try again.'); window.location.assign(result.url); }
    catch (e) { setError((e as Error).message); setBusy(''); }
  }
  return <><main id="main-content" className="page-width pricing-page"><div className="pricing-intro"><div className="eyebrow"><span className="tiny-star">✳</span> SMALL BUSINESS. OPEN DOORS.</div><h1>A better journey.<br /><span className="serif-italic">A sensible starting point.</span></h1><p>Start with one customer journey. See the roadblocks.<br />Move forward with fixes and dated evidence.</p><div className="test-mode-label"><span /> DEMO CHECKOUT · STRIPE TEST MODE</div></div>{billing && <div className={`billing-state ${billing.active ? 'billing-active' : ''}`} role="status"><CheckCircle2 size={22} /><div><strong>{billing.active ? `${billing.plan.charAt(0).toUpperCase() + billing.plan.slice(1)} plan active` : 'Checkout recorded; plan not active yet'}</strong><p>{billing.testMode ? 'Your Stripe test checkout was verified. No real payment was taken.' : 'Checkout status was verified with Stripe.'}</p></div></div>}{error && <ErrorNote>{error}</ErrorNote>}<div className="pricing-grid">{plans.map(plan => <article key={plan.id} className={`price-card ${plan.featured ? 'price-featured' : ''}`}>{plan.featured && <div className="popular-label"><Sparkles size={12} /> MADE FOR YOUR NEXT CUSTOMER</div>}<div className="price-tag">{plan.tag}</div><h2>{plan.name}</h2><p className="price-description">{plan.description}</p><div className="price-amount"><span>$</span>{plan.price}<small>{plan.id === 'free' ? '/ always' : '/ month'}</small></div>{plan.id === 'free' ? <Link className="button button-outline full-width" to="/">{plan.button} <ArrowUpRight size={17} /></Link> : <Button className={`${plan.featured ? 'button-lime' : 'button-dark'} full-width`} disabled={!!busy} onClick={() => void checkout(plan.id)}>{busy === plan.id ? <Loader2 className="spin" size={16} /> : plan.button}<ArrowUpRight size={17} /></Button>}<div className="price-features-label">A WAY FORWARD, WITH</div><ul>{plan.features.map(f => <li key={f}><Check size={15} />{f}</li>)}</ul></article>)}</div><div className="pricing-note"><ShieldCheck size={18} /><p>This build demonstrates checkout in Stripe test mode. Fix application is available for the included demo store. Live websites receive journey testing and diagnosis.</p></div><section className="pricing-faq"><div><div className="eyebrow">A LITTLE MORE CLARITY</div><h2>Good questions.<br /><span className="serif-italic">Straight answers.</span></h2></div><div className="faq-list">{[{ q: 'What exactly does a passing journey mean?', a: 'The selected task reached a deterministic success check during that run. The evidence records the announcements, actions, and time. It applies to that specific journey; human testing adds other perspectives.' }, { q: 'Will Journeyproof change my live website?', a: 'Live website journeys test and diagnose. The included demo store shows the fix workflow in a separate copy, with a source diff and your approval for proposed labels and image descriptions.' }, { q: 'Does the runner place orders or submit forms?', a: 'No. Store journeys stop after an item is added to the cart, before checkout or payment. Restaurant journeys look for menu items and prices.' }, { q: 'Can I replay a journey without the model?', a: 'Yes. Each run records its actions and announcements. Replay reads that saved evidence without making another model call.' }].map(item => <details key={item.q}><summary>{item.q}<Plus size={18} /></summary><p>{item.a}</p></details>)}</div></section></main><Footer /></>;
}

function NotFound() { return <main id="main-content" className="page-width loading-page"><span className="eyebrow">A SMALL DETOUR</span><h1>This path ends here.</h1><p>Let’s get you back to the start of a better journey.</p><Link className="button button-lime" to="/">Back to Journeyproof <ArrowRight size={18} /></Link></main>; }

function HashScroll() { const location = useLocation(); useEffect(() => { if (location.hash) { const frame = requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView()); return () => cancelAnimationFrame(frame); } }, [location.pathname, location.hash, location.key]); return null; }

function ReplayNotice({ run }: { run: Run }) { const [source, setSource] = useState<Run | null>(null); useEffect(() => { if (run.parentId) api<Run>(`/api/runs/${run.parentId}`).then(setSource).catch(() => {}); }, [run.parentId]); return <div className="replay-notice"><RotateCcw size={17} /><p><strong>Recorded evidence{source ? ` from ${date(source.createdAt)}` : ''}.</strong> This is a replay of saved actions and announcements, not a fresh website test.</p></div>; }

export default function App() { return <div id="top"><a className="skip-link" href="#main-content">Skip to content</a><Header /><HashScroll /><Routes><Route path="/" element={<Home />} /><Route path="/runs/:id" element={<RunPage />} /><Route path="/reports/:id" element={<ReportPage />} /><Route path="/pricing" element={<PricingPage />} /><Route path="*" element={<NotFound />} /></Routes></div>; }
