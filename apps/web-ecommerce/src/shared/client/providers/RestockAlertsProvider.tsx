'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import Api from '@/core/client/api/Api';
import { useCurrentUser } from './CurrentUserProvider';
import type { RestockPreference } from '@/shared/types/customer-tools';
const Context = createContext<{
  rows: RestockPreference[];
  loading: boolean;
  save: (productId: number, active: boolean) => Promise<void>;
} | null>(null);
export function RestockAlertsProvider({ children }: { children: ReactNode }) {
  const { user } = useCurrentUser();
  const userId = user?.id;
  const [state, setState] = useState<{ userId: number | null; rows: RestockPreference[]; loading: boolean }>({
    userId: null,
    rows: [],
    loading: false,
  });
  useEffect(() => {
    let current = true;
    if (!userId) {
      setState({ userId: null, rows: [], loading: false });
      return;
    }
    setState({ userId, rows: [], loading: true });
    void Api.get('/notifications/restocks')
      .then((response: { data: RestockPreference[] }) => {
        if (current) setState({ userId, rows: response.data, loading: false });
      })
      .catch(() => {
        if (current) setState({ userId, rows: [], loading: false });
      });
    return () => {
      current = false;
    };
  }, [userId]);
  const save = async (productId: number, active: boolean) => {
    if (!user) return;
    const response = await Api.post('/notifications/restocks/' + productId, { active });
    setState((previous) =>
      previous.userId === user.id ? { ...previous, rows: response.data as RestockPreference[] } : previous,
    );
  };
  return (
    <Context.Provider
      value={{
        rows: state.userId === user?.id ? state.rows : [],
        loading: !!user && (state.userId !== user.id || state.loading),
        save,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useRestockAlerts() {
  const value = useContext(Context);
  if (!value) throw new Error('Missing RestockAlertsProvider');
  return value;
}
