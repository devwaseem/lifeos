export const RPE_OPTIONS = [
  { value: 6, label: 'Moderate effort', description: 'Could have done 4 or more reps.' },
  { value: 7, label: 'Vigorous effort', description: 'Could definitely have done 3 or more reps.' },
  { value: 7.5, label: 'Vigorous effort', description: 'Could maybe have done 3 more reps.' },
  { value: 8, label: 'Very hard effort', description: 'Could definitely have done 2 or more reps.' },
  { value: 8.5, label: 'Very hard effort', description: 'Could maybe have done 2 more reps.' },
  { value: 9, label: 'Extremely hard effort', description: 'Could definitely have done 1 more rep.' },
  { value: 9.5, label: 'Extremely hard effort', description: 'Could maybe have done 1 more rep.' },
  { value: 10, label: 'Max effort', description: 'No more reps possible.' },
] as const

export function isValidRpe(value: unknown): value is number {
  return typeof value === 'number' && RPE_OPTIONS.some((option) => option.value === value)
}
