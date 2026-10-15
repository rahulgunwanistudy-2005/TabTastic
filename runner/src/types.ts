export type Journey = 'add_to_cart' | 'find_menu';
export type Action = { type: 'Tab'|'Shift+Tab'|'Enter'|'Space'|'ArrowUp'|'ArrowDown'|'ArrowLeft'|'ArrowRight'|'Escape'|'type'|'jump'|'done'|'stuck'; text?: string; index?: number; reason?: string };
export type Step = { index: number; timestamp: string; action: Action; announcement: string; focusKey: string; quickNav?: {index:number;role:string;name:string}[] };
export type Finding = { id:string; rule:string; impact:'critical'|'serious'|'moderate'|'minor'; description:string; selector:string; html:string; helpUrl?:string };
export type Fix = { id:string; rule:string; description:string; file:string; approved:boolean; requiresApproval:boolean };
export type Run = { id:string; url:string; journey:Journey; status:'queued'|'running'|'stuck'|'passed'|'error'; createdAt:string; completedAt?:string; steps:Step[]; findings:Finding[]; fixes:Fix[]; reason?:string; screenshot?:string; diff?:string; parentId?:string; fixedRunId?:string; mode:'live'|'replay'; announcer?:string; llm?:string };
export type RunEvent = { type:'status'|'step'|'finding'|'complete'|'error'; data:unknown };
export type EngineOptions = { run:Run; emit:(event:RunEvent)=>void; artifactDir:string; baseUrl:string; signal?:AbortSignal };
