import { RecurrenceFrequency } from '@taskforge/shared-types';
import { computeNextRun } from '@/modules/tasks/task-extras.service';

describe('computeNextRun', () => {
  const base = new Date('2026-07-06T10:00:00Z'); // a Monday

  it('advances daily by interval', () => {
    expect(computeNextRun(base, RecurrenceFrequency.DAILY, 1).toISOString().slice(0, 10)).toBe('2026-07-07');
    expect(computeNextRun(base, RecurrenceFrequency.DAILY, 3).toISOString().slice(0, 10)).toBe('2026-07-09');
  });

  it('advances weekly without daysOfWeek', () => {
    expect(computeNextRun(base, RecurrenceFrequency.WEEKLY, 1).toISOString().slice(0, 10)).toBe('2026-07-13');
  });

  it('picks the next selected weekday for weekly rules', () => {
    // base is Monday; next Friday must be strictly after base
    const next = computeNextRun(base, RecurrenceFrequency.WEEKLY, 1, [5]);
    expect(next.getDay()).toBe(5);
    expect(next.getTime()).toBeGreaterThan(base.getTime());
  });

  it('advances biweekly, monthly, quarterly, yearly', () => {
    expect(computeNextRun(base, RecurrenceFrequency.BIWEEKLY, 1).toISOString().slice(0, 10)).toBe('2026-07-20');
    expect(computeNextRun(base, RecurrenceFrequency.MONTHLY, 1).toISOString().slice(0, 7)).toBe('2026-08');
    expect(computeNextRun(base, RecurrenceFrequency.QUARTERLY, 1).toISOString().slice(0, 7)).toBe('2026-10');
    expect(computeNextRun(base, RecurrenceFrequency.YEARLY, 1).getFullYear()).toBe(2027);
  });
});
