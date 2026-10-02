import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

// Preserve only filter values across module/store remounts. The provider is
// recreated for each user/company; record data, forms and modals stay local.
const FilterContext = createContext<Map<string, unknown> | null>(null);
export function ViewFiltersProvider({ children }: React.PropsWithChildren) {
  const values = useRef(new Map<string, unknown>());
  return <FilterContext.Provider value={values.current}>{children}</FilterContext.Provider>;
}
export function useViewFilter<T>(key: string, initial: T | (() => T)) {
  const values = useContext(FilterContext);
  const [value, setValue] = useState<T>(() => values?.has(key)
    ? values.get(key) as T
    : typeof initial === 'function' ? (initial as () => T)() : initial);
  useEffect(() => { values?.set(key, value); }, [values, key, value]);
  return [value, setValue] as const;
}
