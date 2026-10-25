'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import Api from '@/core/client/api/Api';
import {
  BUILT_IN_CONDITIONS,
  conditionDescription,
  conditionName,
  type ProductConditionType,
} from '@/shared/product-conditions';

// The conditions from Admin > Products > Conditions, loaded once per page and shared by every component. Until they
// arrive (and if the request fails) the built-in ones stand in, so the first render matches the server's.
let loaded: ProductConditionType[] | null = null;
let pending: Promise<ProductConditionType[]> | null = null;
const listeners = new Set<(list: ProductConditionType[]) => void>();

const load = () => {
  pending ??= Api.get('/product-conditions')
    .then(({ data }) => (Array.isArray(data) && data.length ? (data as ProductConditionType[]) : BUILT_IN_CONDITIONS))
    .catch(() => BUILT_IN_CONDITIONS)
    .then((list) => {
      loaded = list;
      listeners.forEach((listener) => listener(list));
      return list;
    });
  return pending;
};

// After staff change the list (Admin), the next read fetches it again.
export const reloadProductConditions = () => {
  pending = null;
  return load();
};

export function useProductConditions() {
  const en = useLocale() === 'en';
  const [all, setAll] = useState<ProductConditionType[]>(loaded ?? BUILT_IN_CONDITIONS);
  useEffect(() => {
    listeners.add(setAll);
    void load().then(setAll);
    return () => {
      listeners.delete(setAll);
    };
  }, []);
  return {
    all,
    // The ones staff may choose for a new unit and customers filter by.
    active: all.filter((type) => type.isActive),
    label: (key: string | null | undefined) => conditionName(all, key, en),
    description: (key: string | null | undefined) => conditionDescription(all, key, en),
  };
}
