import {describe, expect, test} from '@jest/globals';
import {formatShapeLabel} from './naming';

describe('formatShapeLabel', () => {
  test('splits camel case and keeps acronyms together', () => {
    expect(formatShapeLabel('actionPlan')).toBe('Action Plan');
    expect(formatShapeLabel('HTMLParser')).toBe('HTML Parser');
  });

  // Callers interpolate the result ("New {label}"), so a missing label must not come back
  // as `undefined` or `null`.
  test('formats a missing label to an empty string', () => {
    expect(formatShapeLabel(undefined)).toBe('');
    expect(formatShapeLabel(null)).toBe('');
    expect(formatShapeLabel('')).toBe('');
  });
});
