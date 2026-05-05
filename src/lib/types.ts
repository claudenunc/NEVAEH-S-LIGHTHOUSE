export type RiskLevel = 'none' | 'yellow' | 'orange' | 'red'

export interface Message {
  id: string
  session_id: string
  user_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  mood_tag?: string | null
  risk_level?: RiskLevel | null
  created_at: string
}

export interface Session {
  id: string
  user_id: string
  started_at: string
  ended_at: string | null
  is_active: boolean
  mode: 'normal' | 'safety_only' | 'post_crisis'
  mood_score: number | null
  entered_orange: boolean
  entered_red: boolean
  summary: SessionSummary | null
  message_count: number
}

export interface SessionSummary {
  summary?: string
  emotional_tags?: string[]
  themes_surfaced?: string[]
  breakthroughs?: string[]
  unresolved?: string[]
  crisis_flags?: boolean
  modalities_used?: string[]
  mood_trajectory?: string
  plant_for_next_session?: string
  identity_graph_updates?: Record<string, unknown>
}

export interface CrisisScanResult {
  level: RiskLevel
  matches: string[]
}

export interface VoiceFeatures {
  energy: 'low' | 'moderate' | 'high' | 'dysregulated'
  rate: 'slow' | 'normal' | 'fast'
  pauses: number
  pitch_variance: 'flat' | 'normal' | 'variable'
  duration_ms: number
}

export interface NevaehContext {
  user_id: string
  display_name?: string
  total_sessions: number
  profile?: {
    identity_graph: Record<string, unknown>
    mood_baseline: number
  }
  last_sessions: Array<{
    session_id: string
    started_at: string
    ended_at: string | null
    mood_score: number | null
    entered_orange: boolean
    entered_red: boolean
    summary: SessionSummary | null
  }>
  growth_arc: Record<string, unknown> | null
  crisis_history: Array<{
    timestamp: string
    signal_level: RiskLevel
    signals_detected: string[]
    resolved: boolean
  }>
}
