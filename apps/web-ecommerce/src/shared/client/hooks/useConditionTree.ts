'use client';
import { useCallback, useEffect, useState } from 'react';
import Api from '@/core/client/api/Api';
import type { ConditionNode } from '@/shared/condition-tree';

export function useConditionTree(admin = false) {
  const [nodes, setNodes] = useState<ConditionNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setFailed(false);
    Api.get(admin ? '/admin/product-condition-tree' : '/product-condition-tree')
      .then((response) => {
        if (current) setNodes(response.data);
      })
      .catch(() => {
        if (current) setFailed(true);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [admin, revision]);
  return { nodes, loading, failed, reload };
}
