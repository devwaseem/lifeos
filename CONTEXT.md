# LifeOS Training

LifeOS records individual workout sessions and uses reusable routines and a completion-driven queue to decide what comes next without imposing a fixed calendar schedule.

## Language

**Routine**:
A reusable workout structure containing an ordered set of exercises.
_Avoid_: Day, schedule

**Training cycle**:
An ordered, repeating FIFO queue of routines. Completing the queued routine advances the queue; a non-training day does not.
_Avoid_: Calendar plan, weekly schedule

**Training day**:
A local calendar day containing at least one completed workout.
_Avoid_: Cycle slot

**Training cadence**:
The configured number of consecutive training days after which the next calendar day is inferred as a rest day.
_Avoid_: Fixed rest schedule

**Inferred rest day**:
A calendar day following the configured consecutive training-day count, provided no workout has been completed that day. It does not occupy or advance a position in the training cycle.
_Avoid_: Recovery slot, rest routine
