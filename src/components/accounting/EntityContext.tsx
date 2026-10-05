"use client";
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { fetchEntities } from "@/app/(admin)/accounting/actions";
import type { Entity, Profile } from "@/lib/accounting/types";

interface Ctx {
  entities: Entity[];
  entity: Entity | null;
  setEntityId: (id: string) => void;
  profile: Profile | null;
  loading: boolean;
  reloadEntities: () => Promise<void>;
}

const EntityCtx = createContext<Ctx>({
  entities: [],
  entity: null,
  setEntityId: () => {},
  profile: null,
  loading: true,
  reloadEntities: async () => {},
});

export function EntityProvider({ children }: { children: React.ReactNode }) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entityId, setEntityIdState] = useState<string | null>(null);
  // No Supabase auth here — the admin runs on service-role server actions.
  const [profile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const setEntityId = useCallback((id: string) => {
    setEntityIdState(id);
    if (typeof window !== "undefined") localStorage.setItem("entityId", id);
  }, []);

  const reloadEntities = useCallback(async () => {
    const res = await fetchEntities();
    const list = res.ok ? res.data : [];
    setEntities(list);
    const saved = typeof window !== "undefined" ? localStorage.getItem("entityId") : null;
    setEntityIdState((cur) => {
      if (cur && list.some((e) => e.id === cur)) return cur;
      if (saved && list.some((e) => e.id === saved)) return saved;
      return list[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    (async () => {
      await reloadEntities();
      setLoading(false);
    })();
  }, [reloadEntities]);

  const entity = entities.find((e) => e.id === entityId) ?? null;

  return (
    <EntityCtx.Provider value={{ entities, entity, setEntityId, profile, loading, reloadEntities }}>
      {children}
    </EntityCtx.Provider>
  );
}

export const useEntity = () => useContext(EntityCtx);
