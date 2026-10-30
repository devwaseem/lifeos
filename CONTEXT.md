# LifeOS Training

LifeOS records individual workout sessions and uses reusable routines and a completion-driven queue to decide what comes next without imposing a fixed calendar schedule.

## Language

**Routine**:
A reusable identity for related workout sessions, with a saved template of exercises and defaults. A session can substitute, add, or omit exercises without losing its routine association or changing that template.
_Avoid_: Day, schedule

**Training cycle**:
An ordered, repeating queue of distinct routines. Completing any routine in the cycle makes the following routine next; intervening routines are skipped, not completed, while one-off workouts and routines outside the cycle leave its position unchanged.
_Avoid_: Calendar plan, weekly schedule

**Routine template**:
The saved exercise structure and defaults used to start a routine-associated workout. Session changes become template changes only through an explicit update.
_Avoid_: Compliance checklist

**One-off workout**:
A workout session with no routine association. A session associated with a routine outside the active cycle is not a one-off.
_Avoid_: Off-cycle routine

**Training day**:
A local calendar day containing at least one completed workout.
_Avoid_: Cycle slot

**Training cadence**:
The configured number of consecutive training days after which the next calendar day is inferred as a rest day.
_Avoid_: Fixed rest schedule

**Inferred rest day**:
A calendar day following the configured consecutive training-day count, provided no workout has been completed that day. It does not occupy or advance a position in the training cycle.
_Avoid_: Recovery slot, rest routine
