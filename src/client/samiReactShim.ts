import * as StaticReact from 'react';
import type {
  Dispatch,
  SetStateAction,
  RefObject,
  MutableRefObject,
  EffectCallback,
  DependencyList,
  Context,
} from 'react';

function getActiveReact(): any {
  if (typeof window !== 'undefined') {
    if ((window as any).__SAMI_REACT) return (window as any).__SAMI_REACT;
    if ((window as any).React) return (window as any).React;
  }
  return StaticReact;
}

export function useRef<T>(initialValue: T): MutableRefObject<T>;
export function useRef<T>(initialValue: T | null): RefObject<T>;
export function useRef<T = undefined>(): MutableRefObject<T | undefined>;
export function useRef(initialValue?: any): any {
  const r = getActiveReact();
  return (r.useRef || StaticReact.useRef)(initialValue);
}

export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
export function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
export function useState(initialState?: any): any {
  const r = getActiveReact();
  return (r.useState || StaticReact.useState)(initialState);
}

export function useEffect(effect: EffectCallback, deps?: DependencyList): void {
  const r = getActiveReact();
  return (r.useEffect || StaticReact.useEffect)(effect, deps);
}

export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: DependencyList): T {
  const r = getActiveReact();
  return (r.useCallback || StaticReact.useCallback)(callback, deps);
}

export function useMemo<T>(factory: () => T, deps: DependencyList): T {
  const r = getActiveReact();
  return (r.useMemo || StaticReact.useMemo)(factory, deps);
}

export function useId(): string {
  const r = getActiveReact();
  return (r.useId || StaticReact.useId)();
}

export function useTransition(): [boolean, (callback: () => void) => void] {
  const r = getActiveReact();
  return (r.useTransition || StaticReact.useTransition)();
}

export function useContext<T>(context: Context<T>): T {
  const r = getActiveReact();
  return (r.useContext || StaticReact.useContext)(context);
}

export function createContext<T>(defaultValue: T): Context<T> {
  const r = getActiveReact();
  return (r.createContext || StaticReact.createContext)(defaultValue);
}

export function useReducer(reducer: any, initialState: any, initializer?: any): [any, (action: any) => void] {
  const r = getActiveReact();
  return (r.useReducer || StaticReact.useReducer)(reducer, initialState, initializer);
}

export function useLayoutEffect(effect: EffectCallback, deps?: DependencyList): void {
  const r = getActiveReact();
  return (r.useLayoutEffect || StaticReact.useLayoutEffect)(effect, deps);
}

const ReactProxy: any = new Proxy(StaticReact, {
  get(_target, prop) {
    const active = getActiveReact();
    const val = active[prop];
    if (typeof val === 'function') {
      return val.bind(active);
    }
    return val !== undefined ? val : (StaticReact as any)[prop];
  },
});

export default ReactProxy;
export { ReactProxy as React };
