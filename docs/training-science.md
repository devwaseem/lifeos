# Training science: calculation contract

This document defines the evidence boundary for LifeOS training calculations. It is a product-implementation reference, **not medical guidance** and not a diagnostic model.

For a plain-language explanation with worked examples and dashboard-reading guidance, see [Understanding dashboard metrics](../README.md#understanding-dashboard-metrics). This document remains the normative evidence and implementation contract.

## Non-negotiable claims boundary

Training logs can describe completed work, perceived effort, and changes in logged performance. They cannot establish that a person is injured, will be injured, is overtrained, or that changing a calculated workload will prevent injury. In particular, LifeOS **MUST NOT** call a score an injury-risk, safety, recovery, or injury-prevention score; it **MUST NOT** recommend load changes as a way to prevent injury; and it **MUST NOT** attach a medical diagnosis to a trend.

Use neutral language:

- “Recent workload is above this person’s prior logged workload.”
- “Logged performance is lower than the selected baseline.”
- “Consider an easier session, a rest day, or adjusting the plan if that matches how you feel.”

Do not use “safe/unsafe,” “injury predicted,” “at risk of injury,” “fully recovered,” or “deload required.” A user reporting pain, neurological symptoms, acute illness, or other concerning symptoms needs a non-diagnostic stop/modify-training prompt and, where appropriate, a prompt to seek qualified care—not a score-derived clearance.

## Evidence labels

Every calculation and UI explanation should expose its evidence status.

| Label | Meaning | Examples |
| --- | --- | --- |
| **Observed** | A value directly logged by the user. | Weight, repetitions, set RPE, warmup marker, session duration. |
| **Validated construct** | A measured construct supported for the stated use, but still subject to individual and protocol variation. | RPE/RIR as perceived-effort measures; session-RPE load as a within-person internal-load index. |
| **Derived estimate** | An arithmetic estimate from observed data, not a direct physiological measurement. | e1RM, weekly session load, acute:chronic ratio. |
| **Pragmatic heuristic** | A transparent product rule chosen to make data actionable. It is not a validated diagnostic or universal threshold. | 0–3 RIR “hard set,” performance-suppression alert, deload suggestion, confidence cutoffs. |

A confidence label indicates logged-data completeness only. Comparability still depends on the same exercise ID representing a sufficiently consistent protocol; the app does not verify that condition.

## MCP interpretation contract

The MCP analytics surface applies this same evidence boundary. It exposes bounded training summaries, exercise-specific history, routine review, and training-state context; it does not expose SQL, arbitrary database reads, or free-text workout notes.

Every analytics response includes an `asOf` timestamp, source-freshness context, explicit missing inputs, evidence labels, and caveats. Observed subjective check-ins remain distinct from modeled readiness, session-load comparisons, and performance heuristics. The MCP may summarize those signals together, but it MUST NOT collapse them into a medical fatigue, recovery, safety, or injury-risk score.

The MCP is read-only. It may explain possible routine changes in the client conversation, but it cannot store or apply them; routine editing remains a direct user action. Each new workout captures its own pre-workout check-in, keeping the subjective state paired with the resulting session. Pain or illness remains context for cautious interpretation and never generates training clearance or diagnosis.

## First-set performance progression and RPE context

### Definitions and source-backed use

- **RIR** is the user’s estimate of repetitions remaining before momentary muscular failure.
- On the resistance-training-specific RIR-RPE scale, `RPE 10 = 0 RIR`, `RPE 9 = 1 RIR`, and so on. Zourdos et al. observed a strong inverse relation between this scale and squat velocity in both experienced and novice lifters ([Zourdos et al., 2016](https://pubmed.ncbi.nlm.nih.gov/26049792/)).
- **Progression** means changing a training variable in response to observed performance rather than applying an inflexible percentage prescription. Reviews describe RIR-based adjustment as practical and preliminarily useful while emphasizing heterogeneous evidence and individual response ([Helms et al., 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7706636/)).

### Implementation

LifeOS accepts only `6`, `7`, `7.5`, `8`, `8.5`, `9`, `9.5`, and `10` for set and session RPE. The set picker describes those values through estimated repetitions in reserve, from 4 or more repetitions at RPE 6 to no repetitions possible at RPE 10. It stores the selected value unchanged and interprets it as:

```text
estimated_RIR = clamp(10 − set_RPE, 0, 4)
```

Warmup sets are explicitly marked, show RPE as not applicable without exposing the picker, and are excluded from working-set counts, volume, records, progression targets, readiness, muscle dose, and strength estimates. Their stored RPE is always `null`. Active-workout volume also excludes incomplete sets, so values prefilled from history do not count until the user completes those sets.

Each routine exercise stores a minimum and maximum repetition target plus an optional fixed load increment. Equipment settings stores one optional exact list of available loads in kilograms for each equipment type, such as Dumbbells, Cable, Machine, or Barbell. When a workout starts, the matching equipment rack is copied into every exercise in that workout so later settings changes cannot rewrite the target that was prescribed for the saved session. Each warmup and working set is prefilled from the matching set in the latest completed same-exercise session, including load, repetitions, and working-set RPE; if the new routine has more working sets, the final known working set is repeated.

The progression target applies to the first working set:

- Below the repetition ceiling: keep the load and add one repetition.
- At the repetition ceiling with a configured rack for the exercise’s equipment type: select the smallest listed load greater than the previous load and return to the minimum repetitions.
- At the repetition ceiling without an equipment rack but with a routine-level fixed increment: add that increment and return to the minimum repetitions.
- At the highest listed rack load, or without any automatic load rule: repeat the previous load and repetitions.
- RPE does not gate any target. In particular, an RPE 10 first set can still produce the next repetition or load target.

Equipment rack loads are normalized to unique ascending values, but they are not assumed to be evenly spaced. Targets are **suggestions** and do not overwrite values after workout creation. The rack, fallback increments, target band, and adjustment rules are product heuristics rather than universal prescriptions.

The exercise-level progression outcome compares only the completed first non-warmup set with the first working set from the immediately preceding completed same-exercise session:

- At the same external load, more repetitions means **Progressed**, equal repetitions means **Maintained**, and fewer repetitions means **Declined**.
- Bodyweight sets treat missing and zero external load as equivalent.
- Any increase in completed first-set external load means **Progressed**. The calculated target remains a suggestion, not a restriction on valid progression.
- A missing prior session means **Baseline logged**. Missing repetitions or an incomplete first set keeps the result pending; a lower external load is not directly comparable.

RPE explains the first-set result but never changes its status. Equal RPE is labeled same effort; a difference of at least one full RPE point is labeled lower or higher effort. A half-point difference remains visible in the logged values without receiving an effort label. Later sets retain their load, repetitions, RPE, and previous-session reference as fatigue and work-capacity context, but they never override the exercise-level outcome.

The active workout, finish flow, saved workout detail, and exercise history derive this result from stored workout data. The result itself is not persisted, so edits and deletions recalculate the historical comparison.

### Limitations

RIR is a fallible self-report, not a direct count. In a study of 141 trainees, people generally underpredicted repetitions to momentary failure; combined standard errors were about 2.6–3.4 repetitions and accuracy tended to improve with experience ([Steele et al., 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5712461/)). The work used single sets, mostly selectorised machines, so those errors are not a universal correction factor.

Accordingly:

- Do not convert a missing RPE to a fabricated RIR.
- Treat novice, unfamiliar-exercise, low-load/high-repetition, and unsupervised RIR entries as lower-confidence inputs.
- Keep RPE/RIR, repetitions, load, tempo/protocol notes, warmup status, and exercise identity separate. They are related but not interchangeable.

## RPE-adjusted estimated 1RM (e1RM)

### Calculation

The current implementation accepts only a completed, non-warmup set with positive external load, 1–15 completed repetitions, and a supported set RPE:

```text
estimated_RIR = clamp(10 − set_RPE, 0, 5)
estimated_repetitions_to_failure =
  min(20, completed_repetitions + estimated_RIR)
e1RM_Epley =
  round(weight × (1 + estimated_repetitions_to_failure / 30), 1 decimal)
```

Missing effort, non-positive load, or repetitions outside 1–15 returns no estimate. LifeOS rounds each valid set estimate to one decimal before keeping the highest estimate within one exercise exposure. Its current exercise profile is the median of the newest three exposures; trend comparison uses the median of the preceding three.

The Epley equation is a convenient **derived estimate**, not a direct 1RM test. Its RPE adjustment is a product extrapolation from RIR, not a separately validated measurement of maximal strength. Preserve the formula and implementation version with any persisted result; do not combine values generated by different equations in one trend.

Only compare e1RM within the same exercise and sufficiently similar movement variant, equipment, range of motion, tempo, rest context, and loading range. Never use it to clear a user for a maximal attempt.

### Why rep range and exercise matter

The repetitions-at-%1RM relation varies between people and exercises; it is not one universal linear conversion. A meta-regression of 269 studies (6,970 individuals and 898 tests) reported greater uncertainty at lighter loads and found markedly more repetitions for leg press than bench press—for example, approximately 13 versus 9 at 80% 1RM and 19 versus 14 at 70% 1RM ([Nuzzo et al., 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10933212/)). The evidence was largely healthy, younger adults and disproportionately bench press/leg press.

**Product consequence:** represent e1RM as an exercise-specific trend with an uncertainty/caveat, not as a person-wide strength score. Avoid claims that an e1RM from a high-repetition set, a different exercise, or a different machine is equivalent to a tested 1RM. Any minimum/maximum rep range used to decide whether to display e1RM is a **pragmatic data-quality rule**, not a validated cutoff.

## Productive hard-set dose

### Operational and implementation definition

LifeOS currently applies the resistance-training RIR-RPE interpretation directly as an RPE threshold. A working set is considered only after its entire workout has status `completed`; warmups are excluded:

```text
hard_set_credit(set) = 1  when workout and working set are completed
                          and set_RPE ≥ 7
                       0  otherwise

muscle_set_equivalent =
  hard_set_credit × saved_muscle_contribution_fraction
```

`RPE 7–10` corresponds operationally to an estimated `0–3 RIR` band. A primary muscle normally receives a fraction of `1.0`; secondary muscles receive their saved fractional contribution. Decimal values are therefore expected and are set-equivalent accounting values, not literal set counts.

A completed working set with missing RPE receives zero estimated credit in the current aggregate because the result has no third `unknown` bucket. Its contribution fraction remains in the effort-coverage denominator, lowering confidence. Product copy MUST describe this as **uncredited because effort is unknown**, not as proof that the set was easy or non-productive. Do not impute partial credit from missing effort.

The displayed comparison is:

```text
recent_dose =
  round(Σ muscle_set_equivalent during the recent 7 days, 1 decimal)
prior_weekly_dose =
  round(Σ muscle_set_equivalent during the preceding 28 days / 4,
        1 decimal)
dose_ratio = round(recent_dose / prior_weekly_dose, 2 decimals)
```

The implementation uses inclusive timestamp bounds; the exact `now − 7 days` boundary can therefore be admitted by both windows. A missing baseline—or a positive baseline that rounds to `0.0`—returns no ratio and the label **building baseline**.

For a positive rounded baseline, ratios below `0.7` are **below recent**, above `1.3` are **above recent**, and all others are **near recent**. The twenty-segment display recomputes the unrounded quotient of the one-decimal `recent_dose` and positive `prior_weekly_dose`, multiplies it by 50, clamps it to 0–100, and rounds the fill to one of twenty segments. Midpoint `1×` means equal to the prior weekly average and endpoint `2×` means twice that average. No bar is rendered for a null or rounded-zero baseline.

The threshold, binary credit, contribution fractions, comparison bands, and display scale are **pragmatic product heuristics**. They provide a transparent workload proxy; they are not validated units of hypertrophic stimulus, recovery scores, or universal dose prescriptions.

### Evidence boundary

Proximity to failure, repetitions completed, velocity loss, and perceived effort can be recorded. They do not establish that all close-to-failure sets provide the same stimulus. A meta-analysis found no clear hypertrophy advantage for momentary failure over non-failure and no clear advantage for higher over moderate velocity-loss thresholds ([Refalo et al., 2023](https://pubmed.ncbi.nlm.nih.gov/36334240/)).

A randomized acute study at 75% 1RM found greater immediate velocity loss after failure (−25%) than after 1 RIR (−13%) or 3 RIR (−8%), alongside worse perceptual responses; between-protocol differences diminished by 48 hours ([Refalo et al., 2023](https://pubmed.ncbi.nlm.nih.gov/36752989/)). This supports recording proximity to failure and avoiding an assumption that failure is required. It does **not** establish a fatigue diagnosis, recovery timetable, or an individual deload trigger.

## Session-RPE × duration load

### Calculation and capture protocol

The source-supported protocol uses a single retrospective global rating of the whole session on a modified CR-10 scale, commonly captured approximately 30 minutes after the session. LifeOS captures session RPE in the finish flow and prefers that recorded value.

Legacy workouts may contain set RPE without a whole-session RPE. For those records, LifeOS uses the arithmetic mean of completed sets with a positive RPE as an explicit workout-effort estimate. Completed sets without RPE—including treadmill, warm-up, and stretching sets—are ignored. This fallback is not equivalent to the validated session-RPE protocol and the dashboard identifies how many sessions were estimated.

LifeOS uses start-to-finish elapsed minutes, including rest and time spent browsing elsewhere while the workout remains active:

```text
workout_effort =
  recorded session RPE, when present
  otherwise mean(RPE of completed sets with RPE)

workout_load_AU = workout_effort × elapsed_session_minutes
raw_recent_load_AU =
  Σ workout_load_AU during the recent 7 days
raw_prior_weekly_average_AU =
  Σ workout_load_AU during the preceding 28 days ÷ 4
recent_to_prior_AU_ratio =
  round(raw_recent_load_AU / raw_prior_weekly_average_AU, 2 decimals)

displayed_recent_load_AU = round(raw_recent_load_AU)
displayed_prior_weekly_average_AU =
  round(raw_prior_weekly_average_AU)
```

A session contributes only when it is completed, has `completedAt`, and has either recorded session RPE or at least one completed set with positive RPE. A session with no usable effort remains unavailable rather than becoming zero. A missing or zero prior baseline returns no ratio and **building baseline**. Ratios below `0.7` are **below prior**, above `1.3` are **above prior**, and all others are **near prior**.

Status uses the unrounded AU values before the ratio is rounded to two decimals. The cards independently round both AU values to whole numbers, so dividing the displayed cards need not reproduce the status ratio exactly.

The unit is arbitrary units (AU). Foster et al. found session-RPE load consistently related to heart-rate-derived load across cycling, intervals, and basketball, but absolute scores differed ([Foster et al., 2001](https://pubmed.ncbi.nlm.nih.gov/11708692/)). In resistance training specifically, Sweet et al. found global session RPE varied with relative intensity but could meaningfully underestimate the average immediate post-set intensity ([Sweet et al., 2004](https://pubmed.ncbi.nlm.nih.gov/15574104/)).

Compare workout-effort load primarily within the same person, activity type, duration convention, capture method, and training phase. It is an internal-load index—not mechanical volume, muscle-specific stimulus, recovery, or injury risk. An accidentally long-running session inflates AU and should be corrected rather than interpreted physiologically.

## Recent-to-prior workload comparisons

### Systemic AU comparison

The systemic comparison is the `recent_to_prior_AU_ratio` above: the recent seven-day sum divided by the weekly average of the disjoint preceding 28 days. It describes change in logged whole-session internal load.

### Targeted tonnage comparison

Targeted tonnage is a separate external-load proxy scoped to the current Today plan. An active workout takes precedence. Without one, the routine at the head of an active training cycle supplies the plan unless an inferred rest day is due or that routine is missing. The manually selected routine is used only while the cycle is inactive.

```text
set_tonnage = max(0, weight) × max(0, repetitions)

target_fraction =
  Σ saved contribution fractions whose muscles are targets

attributed_target_tonnage =
  set_tonnage × target_fraction

acute_target_tonnage =
  Σ attributed_target_tonnage during the recent 7 days

chronic_weekly_target_tonnage =
  Σ attributed_target_tonnage during the trailing 28 days ÷ 4

target_tonnage_ratio =
  acute_target_tonnage / chronic_weekly_target_tonnage
```

Only completed sets with weight and repetitions contribute. Set timestamps fall back to workout completion or start time. Because matching contribution fractions are summed, attributed target tonnage can exceed raw implement tonnage when several contributed muscles are targets.

Unlike the systemic AU denominator, the trailing 28-day targeted-tonnage denominator includes the recent seven days. A missing or zero denominator returns **no baseline**. Ratios below `0.9` are **below prior**, above `1.1` are **above prior**, and all others are **near prior**.

Tonnage ignores range of motion, tempo, leverage, machine geometry, technique, and proximity to failure. Bodyweight work contributes zero without a recorded external load. It is therefore descriptive context only and MUST NOT be framed as equivalent work across exercises or as a safety threshold.

### Evidence boundary

Neither ratio is an individual injury predictor, causal risk score, or validated safe/unsafe threshold. A methodological critique concluded that acute:chronic ratio properties, ambiguity, statistical artifacts, lack of causal evidence, and inconsistent injury associations make ACWR unsuitable for injury-prevention recommendations ([Impellizzeri et al., 2020](https://pubmed.ncbi.nlm.nih.gov/32502973/)).

Product copy MUST expose which numerator, denominator, measure, and windows are being compared. Terms such as “spike,” “optimal,” “safe,” and “dangerous” MUST NOT be inferred from the ratio.

## Muscle-readiness decay heuristic

Readiness is a deterministic decay of logged muscle exposure, not a physiological measurement:

| Set observation | Stimulus |
| --- | ---: |
| RPE 10 | 1.00 |
| RPE 9–9.5 | 0.90 |
| RPE 8–8.5 | 0.75 |
| RPE 7–7.5 | 0.55 |
| RPE 6 | 0.35 |
| Missing RPE | 0.65 |

Each non-warmup set stimulus is multiplied by the saved muscle-contribution fraction. For each workout and muscle:

```text
workout_muscle_exposure =
  min(1, Σ(set_stimulus × muscle_fraction) / 6)
```
The dashboard exposes the unnormalized sum as **modeled set units** alongside the decay window so the inputs behind each readiness percentage remain visible.

The exposure is timestamped at that workout’s latest contributing set and decays linearly:

```text
remaining_exposure =
  exposure × max(0, 1 − elapsed_hours / muscle_window_hours)

residual_exposure = min(1, Σ remaining_exposure)
readiness = round((1 − residual_exposure) × 100)
```

Current windows are Chest 60h; Back, Quadriceps, Hamstrings, Glutes, and Full body 72h; Shoulders, Calves, Biceps, Triceps, Adductors, Abductors, and Other 48h; Forearms and Core 36h; Cardio 24h.

Values below 50 are **Recent load**, 50–79 **Partial estimate**, 80–99 **Ready estimate**, and 100 **No residual estimate**. The app searches forward in one-hour steps, up to three muscle windows, to report the first estimated time reaching the 80% display threshold.

Target readiness is the rounded arithmetic mean of every attributed target muscle’s readiness. Routine ranking uses the same mean and names the lowest-readiness contributed muscle separately as the limiting muscle. A muscle with no exposure defaults to 100 because the model has no residual exposure to report, not because recovery was measured.

The stimulus weights, six-set normalization, linear decay, fixed windows, and 80% threshold are product heuristics. They MUST NOT be represented as tissue-healing timelines, biological clearance, injury risk, or universal rest prescriptions.
Personal-record status and subjective soreness are not inputs to this model. A personal record can therefore coexist with a high readiness estimate when the session contains few attributed sets; users must not treat the estimate as overriding how the muscle actually feels.

## Scheduling heuristics

### FIFO training cycle and inferred rest

A training cycle is an ordered, repeating FIFO queue containing routines only. Completing a workout linked to the routine at the head of the queue advances to the next routine. Cancelling a workout, completing a one-off workout, or taking a day off does not advance the queue.

The cycle stores an editable `training_days_before_rest` value from 1 through 7. LifeOS counts distinct local calendar dates with completed workouts immediately before today. An inferred rest day is due only when:

```text
today has no completed workout
and consecutive_training_days_before_today ≥ training_days_before_rest
```

The rest day is not a routine or queue position. If the user does not train, the condition clears automatically on the following calendar day and the same routine remains next. An earlier non-training day similarly breaks the streak without moving the queue. If the user deliberately trains on an inferred rest day, the queued routine starts normally and advances only after completion.

This cadence is an explicit user scheduling preference. It counts calendar days, not workload, muscle overlap, sleep, symptoms, biological fatigue, recovery, or injury risk.

### Best-fit routine

For every non-deleted routine with at least one exercise, LifeOS gathers all primary and secondary contributed muscles, substitutes `100%` for muscles with no recorded exposure, and calculates the rounded arithmetic mean of their readiness estimates. Routines are ranked from highest mean to lowest; ties use routine name. The lowest-readiness contributed muscle is displayed separately as the limiting muscle.

This is a deterministic ranking convenience. It does not establish that the first routine is optimal, safe, or required.

### Consecutive-load governor

LifeOS counts local calendar days with completed workouts backward from today when today contains a workout, otherwise from yesterday. At three or more consecutive days, starting another workout requires an explicit force override.

The governor counts days, not session load, muscle overlap, sleep, symptoms, or biological fatigue. It is a deliberate scheduling interruption—not a diagnosis or evidence that training must stop.

## Performance suppression and deload heuristics

### A non-diagnostic trend signal

Performance and recovery fluctuate with training, sleep, nutrition, life stress, unfamiliarity, measurement error, and protocol changes. They should be assessed as a pattern, not a single score.

For each exercise with at least six valid e1RM exposures, LifeOS compares the newest three with the preceding three:

```text
recent_performance = median(e1RM of newest 3 exposures)
baseline_performance = median(e1RM of preceding 3 exposures)
performance_change_percent =
  100 × (recent_performance − baseline_performance)
      / baseline_performance

rpe_change =
  mean(recent exposure RPE) − mean(baseline exposure RPE)
  when both windows contain RPE, otherwise 0

max_effort_rate_change =
  mean(recent fraction of sets at RPE 10)
    − mean(baseline fraction of sets at RPE 10)
```

An exercise qualifies as a suppression candidate only when `performance_change_percent ≤ −3` and either `rpe_change ≥ 0.5` or `max_effort_rate_change ≥ 0.15`. The dashboard shows **Consider an easier session** when the mean reduction among qualifying exercises is at least `5%` or at least two exercises qualify; otherwise it shows **Performance watch**.

Signal confidence is low until any exercise has six valid exposures, moderate when same-ID history exists without a qualifying signal or exactly one exercise qualifies, and high when at least two exercises qualify. This confidence still does not verify protocol comparability.

These windows, thresholds, and suggested action are product heuristics. The implementation groups exposures by exercise ID but does not detect changes in equipment setup, range of motion, tempo, technique, or data provenance. Users must treat changed protocols as non-comparable. The signal MUST be described as repeated suppression in same-ID logged performance—not fatigue, overtraining, injury risk, or a mandatory deload.

### Deload recommendation

A deload is a period of reduced training stress intended to mitigate physiological and psychological fatigue, promote recovery, and improve preparedness. The definition comes from an international Delphi consensus, which also states that deloading is under-researched and current practice is mainly coach experience ([Bell et al., 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10511399/)). It supports possible reductions in volume, intensity, frequency, and/or proximity to failure, but does not establish an optimal reduction, duration, schedule, or trigger.

A LifeOS deload prompt is therefore an **optional, editable heuristic**, not an instruction. A conservative implementation can offer choices to reduce sets/repetitions, load, frequency, or proximity to failure while preserving the logged plan and allowing the user to decline. Fixed rules such as “every fourth week,” “reduce volume by 50%,” “deload after three hard days,” and “rest each muscle for a fixed number of hours” are practice conventions, not validated universal prescriptions.

The overtraining consensus further emphasizes that distinguishing non-functional overreaching from overtraining syndrome is difficult and depends on clinical outcome and exclusion diagnosis ([Meeusen et al., 2013](https://pubmed.ncbi.nlm.nih.gov/23247672/)). The app must not attempt that distinction.

## Progress report aggregation

The progress report is a deterministic view over the same training calculations used by the dashboard and MCP. AI does not calculate its metrics or assign its verdict. The browser builds the report from current device-local data, while MCP builds analytics from synchronized D1 data; cloud synchronization freshness is shown separately from local report freshness.

An exercise receives a report status only from its same-ID e1RM profile:

| Status | Implemented rule |
| --- | --- |
| Progressing | Recent three-exposure median is at least `3%` above the preceding three |
| Stable | The comparison is greater than `−3%` and less than `3%` |
| Declining | Recent median is at least `3%` below the preceding median |
| Insufficient data | Fewer than six valid comparable e1RM exposures |

The overall verdict summarizes all observed strength exercises, not only the representative rows displayed:

- **Needs attention:** at least two exercises are declining and declining exercises outnumber progressing exercises.
- **Progressing:** at least one exercise is progressing, none are declining, and progressing exercises are at least as numerous as stable exercises.
- **Mixed:** at least one progressing or declining signal exists but neither rule above applies.
- **Holding steady:** every comparable exercise is stable.
- **Building evidence:** no exercise has a six-exposure comparison.

Overall confidence is high only with at least four comparable exercises when at least 60% of those profiles have high confidence. It is moderate with at least two comparable exercises and low otherwise. This confidence still describes data coverage, not certainty about adaptation or protocol comparability.

The displayed representative exercises are ranked deterministically by active-cycle membership, active-routine membership, comparison availability, confidence, logged exposure count, and recency. The report can therefore emphasize currently programmed movements without letting a language model choose or omit evidence.

The optional AI narrative receives the typed report plus bounded citation records. Every finding must cite a supplied record, and the narrative is cached only for the exact report fingerprint. A changed completed workout, routine, cycle, profile, or report period produces a different fingerprint. In-progress workouts are excluded from progression evidence and do not invalidate the report narrative until completion. If the latest check-in records pain or illness, LifeOS replaces model-proposed actions with a deterministic user-review message and does not provide training clearance.

## Confidence labels for implementation

Confidence qualifies sample count and required-field coverage. It never measures certainty about recovery, adaptation, fatigue, injury, or comparability that the app has not verified.

The shared rule used for exercise-strength profiles, muscle dose, and systemic load is:

| Label | Implemented rule | Required interpretation |
| --- | --- | --- |
| Low | Fewer than 3 applicable samples, or less than 50% required-data coverage | Limited logged data coverage |
| Moderate | At least 3 applicable samples and at least 50% coverage | Trend is based on partial logged-data coverage |
| High | At least 6 applicable samples and at least 75% coverage | Trend is based on consistent required-field coverage |

Muscle readiness uses a separate rule: fewer than three completed sessions is low; at least six completed sessions with at least 75% completed-set RPE coverage is high; every other case is moderate.

Muscle-dose coverage is contribution-weighted and treats non-null working-set RPE as known effort. Systemic-load coverage is the fraction of completed sessions with recorded or estimated workout effort; estimated-session counts remain visible because mean set RPE is not interchangeable with session RPE. The implementation does not inspect protocol, technique, or provenance changes; those remain user interpretation requirements and can invalidate an otherwise high-confidence same-ID trend.

Muscle-dose confidence has an additional implementation detail: when a muscle has any recent-window coverage record, that coverage replaces rather than combines with baseline-window coverage; baseline coverage is used only when recent coverage is absent. The sample count passed to the shared confidence rule is `round(Σ muscle_contribution_fraction)`, not the number of physical sets. For example, six fully known sets credited at `0.25` each produce a weighted sample count of `round(1.5) = 2`.

## Implementation map

| Concern | Implementation authority |
| --- | --- |
| RPE-adjusted e1RM, hard-set dose, session AU, confidence, and performance suppression | `src/lib/training-science.ts` |
| Targeted tonnage, muscle readiness, routine ranking, and consecutive-day warning | `src/lib/training-readiness.ts` |
| Double-progression and live execution targets | `src/lib/progression.ts` |
| Muscle contribution fractions | `src/lib/muscle-contributions.ts` |
| Dashboard labels and display composition | `src/lib/components/TodayView.svelte` |
| Segmented scale clamping and fill count | `src/lib/components/SegmentedProgressBar.svelte` |

## Source notes

The sources below are primary studies, a primary consensus process, or a peer-reviewed synthesis/consensus statement used to bound implementation claims:

1. Zourdos MC, et al. *Novel Resistance Training-Specific Rating of Perceived Exertion Scale Measuring Repetitions in Reserve.* **J Strength Cond Res.** 2016;30:267–275. [PubMed](https://pubmed.ncbi.nlm.nih.gov/26049792/) · [DOI](https://doi.org/10.1519/JSC.0000000000001049)
2. Steele J, et al. *Ability to predict repetitions to momentary failure is not perfectly accurate, though improves with resistance training experience.* **PeerJ.** 2017;5:e4105. [Full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC5712461/) · [DOI](https://doi.org/10.7717/peerj.4105)
3. Helms ER, et al. *Methods for Regulating and Monitoring Resistance Training.* **J Hum Kinet.** 2020;74:23–42. [Full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC7706636/) · [DOI](https://doi.org/10.2478/hukin-2020-0011)
4. Nuzzo JL, et al. *Maximal Number of Repetitions at Percentages of the One Repetition Maximum: A Meta-Regression and Moderator Analysis of Sex, Age, Training Status, and Exercise.* **Sports Med.** 2023;54:303–321. [Full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC10933212/) · [DOI](https://doi.org/10.1007/s40279-023-01937-7)
5. Refalo MC, et al. *Influence of Resistance Training Proximity-to-Failure on Skeletal Muscle Hypertrophy: A Systematic Review with Meta-analysis.* **Sports Med.** 2023;53:649–665. [PubMed](https://pubmed.ncbi.nlm.nih.gov/36334240/) · [DOI](https://doi.org/10.1007/s40279-022-01784-y)
6. Refalo MC, et al. *Influence of Resistance Training Proximity-to-Failure, Determined by Repetitions-in-Reserve, on Neuromuscular Fatigue in Resistance-Trained Males and Females.* **Sports Med Open.** 2023;9:10. [PubMed](https://pubmed.ncbi.nlm.nih.gov/36752989/) · [DOI](https://doi.org/10.1186/s40798-023-00554-y)
7. Foster C, et al. *A new approach to monitoring exercise training.* **J Strength Cond Res.** 2001;15:109–115. [PubMed](https://pubmed.ncbi.nlm.nih.gov/11708692/)
8. Sweet TW, et al. *Quantitation of resistance training using the session rating of perceived exertion method.* **J Strength Cond Res.** 2004;18:796–802. [PubMed](https://pubmed.ncbi.nlm.nih.gov/15574104/) · [DOI](https://doi.org/10.1519/14153.1)
9. Impellizzeri FM, et al. *Acute:Chronic Workload Ratio: Conceptual Issues and Fundamental Pitfalls.* **Int J Sports Physiol Perform.** 2020;15:907–913. [PubMed](https://pubmed.ncbi.nlm.nih.gov/32502973/) · [DOI](https://doi.org/10.1123/ijspp.2019-0864)
10. Bell L, et al. *Integrating Deloading into Strength and Physique Sports Training Programmes: An International Delphi Consensus Approach.* **Sports Med Open.** 2023;9:87. [Full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC10511399/) · [DOI](https://doi.org/10.1186/s40798-023-00633-0)
11. Meeusen R, et al. *Prevention, diagnosis, and treatment of the overtraining syndrome: joint consensus statement of the European College of Sport Science and the American College of Sports Medicine.* **Med Sci Sports Exerc.** 2013;45:186–205. [PubMed](https://pubmed.ncbi.nlm.nih.gov/23247672/) · [DOI](https://doi.org/10.1249/MSS.0b013e318279a10a)
