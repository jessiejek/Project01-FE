import { Observable, catchError, defer, map, of, startWith } from 'rxjs';
export interface LoadState<T> { status: 'loading' | 'ready' | 'error'; data: T; }
/** Keep request failure distinct from a successful empty response. */
export function loadState<T>(request: () => Observable<T>, empty: T): Observable<LoadState<T>> {
  return defer(request).pipe(
    map((data): LoadState<T> => ({ status: 'ready', data })),
    catchError(() => of<LoadState<T>>({ status: 'error', data: empty })),
    startWith<LoadState<T>>({ status: 'loading', data: empty })
  );
}
