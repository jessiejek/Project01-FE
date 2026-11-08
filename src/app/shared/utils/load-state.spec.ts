import { Subject, of, throwError } from 'rxjs';
import { LoadState, loadState } from './load-state';
describe('Request state (no backend)', () => {
  it('starts loading without presenting a ready empty value', () => {
    const request = new Subject<number[]>(); const states: LoadState<number[]>[] = [];
    const sub = loadState(() => request, []).subscribe(s => states.push(s));
    expect(states.map(s => s.status)).toEqual(['loading']); sub.unsubscribe();
  });
  it('recognizes a genuine empty result', () => {
    const states: LoadState<number[]>[] = [];
    loadState(() => of([]), []).subscribe(s => states.push(s));
    expect(states.map(s => s.status)).toEqual(['loading', 'ready']);
  });
  it('keeps an error distinct from an empty result', () => {
    const states: LoadState<number[]>[] = [];
    loadState<number[]>(() => throwError(() => new Error('offline')), []).subscribe(s => states.push(s));
    expect(states.map(s => s.status)).toEqual(['loading', 'error']);
  });
});
