"use client";
import { useEffect, useState, useCallback } from "react";
import type { Account, Project, LedgerRow, JournalEntry } from "@/lib/accounting/types";
import { listAccounts, listProjects, getLedger, listEntries } from "@/app/(admin)/accounting/actions";

export function useAccounts(entityId: string | null) {
  const [data, setData] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!entityId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await listAccounts(entityId);
    setData(res.ok ? res.data : []);
    setLoading(false);
  }, [entityId]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { accounts: data, loading, reload };
}

export function useProjects(entityId: string | null) {
  const [data, setData] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!entityId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await listProjects(entityId);
    setData(res.ok ? res.data : []);
    setLoading(false);
  }, [entityId]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { projects: data, loading, reload };
}

export function useLedger(entityId: string | null) {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!entityId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await getLedger(entityId);
    setRows(res.ok ? res.data : []);
    setLoading(false);
  }, [entityId]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { rows, loading, reload };
}

export function useEntries(entityId: string | null) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!entityId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await listEntries(entityId);
    setEntries(res.ok ? res.data : []);
    setLoading(false);
  }, [entityId]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { entries, loading, reload };
}
