# NEVAEH MEMORY SCHEMA
## The data structures that give NEVAEH persistent memory across sessions

Memory is what makes NEVAEH different from every other AI mental health tool on the market. This schema defines exactly what gets saved, how it's structured, and how it grows over time.

Three core objects:
1. **`identity_graph`** — who the person is (grows slowly, deeply)
2. **`session_summary`** — what happened (written after every session)
3. **`growth_arc`** — how they're changing over time (longitudinal)

All timestamps ISO 8601. All JSON. Store in Supabase.

---

## 1. IDENTITY GRAPH

Stored per-user. Updated after every session as new information surfaces. NEVAEH never interrogates to fill this — it fills itself naturally through conversation.

### 1.1 What you need on session 1 (minimum viable)
```json
{
  "user_id": "uuid",
  "created_at": "2026-04-16T22:41:00Z",
  "updated_at": "2026-04-16T22:41:00Z",
  "basics": {
    "preferred_name": "string | null",
    "pronouns": "string | null",
    "age_range": "string | null",
    "timezone": "string | null"
  },
  "arrival": {
    "what_brought_them": "string — in their own words",
    "support_type_wanted": "listen | frameworks | accountability | unclear",
    "referral_source": "string | null",
    "first_disclosed": ["string"]
  },
  "consent": {
    "disclosure_accepted": true,
    "disclosure_accepted_at": "ISO timestamp",
    "emergency_contact_shared": false
  }
}
```

### 1.2 What you need by session 5 (the shape of them)
Fields added as they surface. Never forced. `null` if not yet known.
```json
{
  "basics": { "...": "..." },
  "arrival": { "...": "..." },
  "consent": { "...": "..." },
  "story": {
    "current_life_situation": "string | null",
    "relationships_of_significance": [
      {
        "relation": "mother | father | partner | sibling | friend | child | other",
        "name_or_label": "string",
        "valence": "close | complicated | estranged | loss | protective | source_of_pain",
        "notes": "string"
      }
    ],
    "losses": [
      { "who_or_what": "string", "when": "string", "still_processing": true }
    ],
    "formative_events": [
      { "event": "string", "age_or_year": "string", "impact": "string" }
    ]
  },
  "patterns": {
    "recurring_themes": ["string"],
    "protective_parts": ["string"],
    "self_talk_patterns": ["string"],
    "somatic_tendencies": ["where they hold it"]
  },
  "support_system": {
    "in_therapy": "true | false | unknown",
    "therapist_known": "bool",
    "medication": "on | off | unknown | declined_to_share",
    "trusted_humans": ["string"],
    "isolation_level": "connected | thin | isolated | unknown"
  },
  "faith": {
    "activated": false,
    "tradition": "string | null",
    "relationship_to_faith": "source_of_strength | wounded | seeking | complicated | n_a"
  }
}
```

### 1.3 What you need by session 20 (the depth of them)
Everything above, plus:
```json
{
  "values": {
    "what_matters_most": ["string"],
    "who_they_want_to_become": "string",
    "north_star": "string"
  },
  "capacity": {
    "modalities_that_land": ["dispenza", "ruiz", "cbt", "ifs", "act", "somatic", "faith"],
    "modalities_to_avoid": ["string"],
    "preferred_pace": "slow | medium | direct",
    "prefers_questions_or_statements": "questions | statements | mix"
  },
  "crisis_history": [
    {
      "date": "ISO",
      "tier": 1,
      "trigger_summary": "string",
      "resolution": "string",
      "connected_to_human_help": true,
      "beacon_notified": true
    }
  ],
  "breakthrough_moments": [
    {
      "date": "ISO",
      "realization": "string — in their own words",
      "what_opened_it": "string",
      "anchored_phrase": "string — the words they used that we refer back to"
    }
  ],
  "anchors": {
    "images_they_use": ["string — metaphors and images they return to"],
    "phrases_theyve_owned": ["string"],
    "their_own_wisdom": ["string — wise things they said that we reflect back"]
  }
}
```

### 1.4 Write rules
- **Never delete.** Only append or supersede (keep history).
- **Consent-gated.** If user explicitly asks you not to remember something, flag the field `excluded_by_user_request: true` and do not reference it.
- **User-correctable.** If user says "that's not accurate about me," update immediately and note `corrected_by_user_at`.
- **Never fabricate.** If a field has no source in conversation, it stays `null`. No inference beyond what they said.

---

## 2. SESSION SUMMARY

Written by a post-session agent (separate Claude call) immediately after every session. Stored per-session, linked to user_id.

### 2.1 Full session_summary structure
```json
{
  "session_id": "uuid",
  "user_id": "uuid",
  "session_number": 7,
  "started_at": "2026-04-16T22:41:00Z",
  "ended_at": "2026-04-16T23:58:00Z",
  "duration_minutes": 77,
  "message_count": 42,

  "state_at_open": {
    "emotional_tone": "heavy | mixed | bright | flat | dissociated | anxious | activated | calm",
    "energy_level": 1,
    "presenting_concern": "string — what they brought in, in their words"
  },

  "state_at_close": {
    "emotional_tone": "string",
    "energy_level": 5,
    "shift_observed": "softer | lighter | grounded | same | heavier | unresolved",
    "body_state": "string | null"
  },

  "emotional_tags": [
    "grief",
    "shame",
    "hope_flicker",
    "self_compassion_emerging"
  ],

  "themes_surfaced": [
    "mother_wound",
    "not_enough_story",
    "body_tension_holding"
  ],

  "modalities_used": [
    {
      "modality": "ifs",
      "moment": "string — what was happening",
      "user_response": "landed | deflected | partial | breakthrough"
    }
  ],

  "breakthrough_moments": [
    {
      "moment": "string — what happened",
      "user_words": "string — exact quote",
      "significance": "first_time_said | pattern_recognized | part_met | frame_shifted | body_released"
    }
  ],

  "unresolved_threads": [
    {
      "thread": "string — the thing that surfaced but wasn't resolved",
      "why_unresolved": "ran_out_of_time | user_not_ready | needs_more_sessions | requires_therapist",
      "priority_next_session": "high | medium | low"
    }
  ],

  "resistance_noted": [
    {
      "topic": "string",
      "how_it_showed": "string",
      "response": "honored | gently_named | deferred"
    }
  ],

  "crisis_signal": {
    "fired": false,
    "tier": null,
    "trigger_words": null,
    "safety_assessment": null,
    "plan_disclosed": null,
    "means_disclosed": null,
    "human_help_connected": null,
    "beacon_notified": null,
    "notes": null
  },

  "plant_for_next_session": "string — the invitation or thing to carry",
  "what_nevaeh_is_holding": "string — what to reference next time",

  "quality_flags": {
    "user_seemed_heard": true,
    "modalities_appropriate": true,
    "boundaries_honored": true,
    "anything_to_flag_for_review": "string | null"
  }
}
```

### 2.2 Crisis session variant
When `crisis_signal.fired == true`, the structure expands:
```json
{
  "crisis_signal": {
    "fired": true,
    "tier": 2,
    "trigger_words": "exact quoted user message",
    "timestamp": "ISO",
    "safety_assessment": {
      "asked_directly": true,
      "plan_disclosed": "string | null",
      "means_disclosed": "string | null",
      "timeframe": "tonight | this_week | vague | none"
    },
    "response_provided": {
      "resources_shared": ["988", "crisis_text_line", "911"],
      "safety_plan_created": true,
      "means_reduction_discussed": true,
      "human_contact_identified": "string | null"
    },
    "human_help_connected": "true | false | declined | unclear",
    "ended_session_in_state": "safer | same | worse",
    "beacon_notified": true,
    "beacon_handoff_payload": {
      "watch_level": "high",
      "followup_dawn_next_day": true,
      "pattern_watchlist": true,
      "lighthouse_alert": true
    },
    "notes": "string — anything a human reviewer should know"
  }
}
```

### 2.3 Breakthrough tagging rules
A moment is a breakthrough when:
- User says "I've never said that before" or equivalent.
- User has a visible realization (*"oh... oh wow"* / *"I didn't see that until now"*).
- User meets a part they've been at war with, and softens.
- User reframes a core belief with their own words.
- User releases somatically (crying, deep exhale, shaking) after holding.

Record the exact quote. That phrase becomes an `anchor` — we reference it in future sessions.

### 2.4 Unresolved thread flagging rules
A thread is unresolved when:
- Surfaced in conversation but not fully explored.
- User said "I'll come back to that" or moved past it.
- Time ran out before integration.
- User became overwhelmed and eased off.

`priority_next_session: "high"` when: it came up repeatedly, it's connected to a pattern, or user explicitly said to come back to it.

### 2.5 Privacy and retention
- All fields encrypted at rest (Supabase row-level security).
- User owns the data — can request deletion at any time.
- `excluded_by_user_request` fields are stored but never surfaced to NEVAEH.
- Crisis records retained longer for safety continuity, with user awareness.

---

## 3. GROWTH ARC

Longitudinal object, one per user, rebuilt/updated after every 5 sessions (or sooner if significant change).

### 3.1 Structure
```json
{
  "user_id": "uuid",
  "last_updated": "ISO",
  "total_sessions": 24,
  "relationship_duration_days": 187,

  "trajectory": {
    "overall_direction": "movement | plateau | regression | mixed",
    "confidence": 0.82,
    "last_3_sessions_trend": "softening | holding | tightening",
    "last_10_sessions_trend": "clear_progress | gradual_progress | holding_pattern | regression"
  },

  "emotional_baseline": {
    "session_1_5_avg_tone": "heavy",
    "session_20_24_avg_tone": "mixed_with_lightness",
    "delta": "notable_softening"
  },

  "patterns_tracked": [
    {
      "pattern": "self_criticism_spike_after_family_contact",
      "first_noticed": "session_3",
      "last_observed": "session_22",
      "frequency_trend": "decreasing",
      "current_relationship_to_pattern": "seeing_it_in_real_time"
    }
  ],

  "themes_evolution": [
    {
      "theme": "mother_wound",
      "stage_journey": [
        { "session": 2, "stage": "avoiding" },
        { "session": 8, "stage": "naming" },
        { "session": 15, "stage": "feeling" },
        { "session": 22, "stage": "integrating" }
      ]
    }
  ],

  "breakthrough_timeline": [
    {
      "session": 6,
      "date": "ISO",
      "breakthrough": "string — their words",
      "has_held": true,
      "referenced_since": 4
    }
  ],

  "anchor_phrases": [
    "maybe I'm not the problem",
    "the part of me that's scared isn't all of me",
    "I can feel this and still do the thing"
  ],

  "modality_effectiveness": {
    "dispenza": { "used_count": 3, "landed_rate": 0.66 },
    "ruiz": { "used_count": 8, "landed_rate": 0.87 },
    "cbt": { "used_count": 5, "landed_rate": 0.6 },
    "ifs": { "used_count": 12, "landed_rate": 0.91 },
    "act": { "used_count": 4, "landed_rate": 0.75 },
    "somatic": { "used_count": 18, "landed_rate": 0.88 },
    "faith": { "used_count": 0, "landed_rate": null }
  },

  "capacity_growth": {
    "session_length_tolerance": "increased",
    "depth_tolerance": "increased",
    "silence_tolerance": "increased",
    "self_compassion_available": "emerging"
  },

  "risk_profile": {
    "crisis_events_total": 1,
    "last_crisis_date": "ISO",
    "days_since_last_crisis": 94,
    "current_risk_level": "low",
    "beacon_watch_level": "routine"
  },

  "regression_signals": {
    "currently_regressing": false,
    "signals_to_watch": ["string"],
    "last_regression_date": null
  }
}
```

### 3.2 What movement looks like in data
- **Emotional baseline shift:** `state_at_open.emotional_tone` trending toward lighter categories over time.
- **Pattern frequency decrease:** a `pattern` tagged across 10 early sessions appearing in only 2 recent sessions.
- **Theme stage progression:** moving from `avoiding` → `naming` → `feeling` → `integrating`.
- **Breakthrough persistence:** `has_held: true` on past breakthroughs + `referenced_since` count growing.
- **Capacity growth:** longer sessions tolerated, deeper work entered, silence no longer fled.
- **Self-talk shift:** `anchor_phrases` becoming kinder over time.
- **Risk reduction:** `days_since_last_crisis` growing, crisis tier decreasing if recurring.

### 3.3 What regression looks like in data
- **Emotional baseline regression:** `state_at_open.emotional_tone` trending heavier over 3+ sessions.
- **Old pattern resurging:** a `pattern` marked `decreasing` suddenly reappearing in every session.
- **Theme back-stepping:** a theme at `integrating` returning to `feeling` or `avoiding`.
- **Shorter sessions:** session length shrinking, engagement dropping.
- **Breakthrough questioning:** user starts contradicting a past anchor phrase.
- **Resistance rising:** `resistance_noted` appearing more in recent sessions.
- **New crisis signal:** `crisis_signal.fired: true` after long stability.
- **Support system thinning:** `support_system.isolation_level` shifting toward "isolated."

### 3.4 Triggers for NEVAEH
When `growth_arc` is injected into a session's memory context, NEVAEH uses it to:
- **Reflect movement:** *"I want you to notice — three months ago this conversation would have looked different."*
- **Reference anchor phrases:** *"You told me once 'I'm not the problem.' Is that still true tonight?"*
- **Flag regression gently:** *"Something feels like the place we were in February. What's come back?"*
- **Choose modalities based on effectiveness:** prefer what's landed, avoid what hasn't.
- **Adjust depth:** if `capacity_growth.depth_tolerance: increased`, go deeper when invited.

### 3.5 Triggers for BEACON handoff
`growth_arc` feeds BEACON's LIGHTHOUSE watchtower:
- `risk_profile.beacon_watch_level` sets DAWN check-in intensity.
- `regression_signals.currently_regressing: true` triggers PATTERN agent monitoring.
- Any new `crisis_events` → immediate LIGHTHOUSE alert.
- Long silences (no sessions for X days after a heavy session) → DAWN outreach.

---

## 4. IMPLEMENTATION NOTES (SUPABASE)

### 4.1 Suggested tables
```
users                  → auth + basic account
user_identity_graph    → identity_graph object (jsonb)
sessions               → session metadata (id, user_id, started_at, ended_at, message_count)
session_messages       → full transcript (encrypted)
session_summaries      → session_summary object (jsonb)
user_growth_arc        → growth_arc object (jsonb)
crisis_events          → flat table for fast BEACON queries
```

### 4.2 Memory injection flow (per session)
1. User opens session.
2. Backend fetches: `user_identity_graph`, last 3 `session_summaries`, current `user_growth_arc`.
3. Assembles `<MEMORY_CONTEXT>` block (see `NEVAEH_SYSTEM_PROMPT.md` Section E).
4. Injects into system prompt.
5. Session proceeds.
6. On session end: post-session summarizer agent writes new `session_summary`.
7. Every 5 sessions (or on crisis): `growth_arc` rebuilt.
8. Identity graph updated with any new fields surfaced.

### 4.3 Cost-awareness
- Full identity graph ≈ 1-3k tokens when dense.
- Last 3 session summaries ≈ 1-2k tokens.
- Growth arc ≈ 1k tokens.
- Memory context budget: **~5k tokens max** → leaves ~3k for system prompt + room for conversation.

Trim strategy if over budget:
- Drop oldest session summary first.
- Compress identity graph to only fields referenced in last 5 sessions.
- Never drop: crisis_history, active anchor phrases, breakthrough moments from last 30 days.

### 4.4 What never goes in memory
- Raw transcripts beyond retention window.
- Identifying info beyond what user consented to share.
- Data user asked to be excluded.
- Anything that couldn't be shown to the user if they asked to see their own data.

---

## THE PRINCIPLE UNDERNEATH

Memory is sacred. These data structures hold someone's soul work — their pain, their breakthroughs, their slow return to themselves.

Handle them like that.

Every field is a piece of a person trusting us with their story. Honor it. Protect it. Use it only to help them heal.

*Nothing is forgotten. I hold their story.*
