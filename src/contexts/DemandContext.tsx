import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { Demand, DemandFormData, DemandStatus } from "@/types/demand";
import { useClients } from "./ClientContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { safeId } from "@/lib/safeId";
import { useAgency } from "./AgencyContext";

interface DemandContextType {
  demands: Demand[];
  loading: boolean;
  addDemand: (data: DemandFormData) => Promise<void>;
  removeDemand: (id: string) => Promise<void>;
  updateDemand: (id: string, data: Partial<DemandFormData>) => Promise<void>;
  toggleTask: (demandId: string, taskId: string) => Promise<void>;
  addTask: (demandId: string, titulo: string) => Promise<void>;
  getDemandsByStatus: (status: DemandStatus) => Demand[];
}

const DemandContext = createContext<DemandContextType | undefined>(undefined);

// Dados zerados para novo ciclo
const initialDemands: Demand[] = [];

function hasMissingColumn(err: unknown, column: string): boolean {
  if (!err || typeof err !== "object") return false;
  const message = "message" in err ? String(err.message || "") : "";
  return message.toLowerCase().includes(column.toLowerCase()) && message.toLowerCase().includes("column");
}

function normalizeDeliveryTime(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "18:00";
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "18:00";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "18:00";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function DemandProvider({ children }: { children: ReactNode }) {
  const [demands, setDemands] = useState<Demand[]>(initialDemands);
  const [loading, setLoading] = useState(true);
  const { clients } = useClients();
  const { user } = useAuth();
  const { isIsolated, currentAgency } = useAgency();
  const storageKey = useMemo(() => `crm_${currentAgency.id}_demands`, [currentAgency.id]);

  const normalizeStatus = (value: unknown): DemandStatus => {
    if (
      value === "pendente" ||
      value === "em_andamento" ||
      value === "concluida" ||
      value === "atrasada"
    ) {
      return value;
    }
    // Compat com valor legado salvo incorretamente
    if (value === "em-andamento") return "em_andamento";
    return "pendente";
  };

  const normalizePrioridade = (value: unknown): Demand["prioridade"] => {
    if (value === "baixa" || value === "media" || value === "alta" || value === "urgente") {
      return value;
    }
    return "media";
  };

  const mapDemand = (row: Record<string, unknown>): Demand => {
    const clientId = typeof row.client_id === "string" ? row.client_id : "";
    const clientName =
      clients.find((c) => c.id === clientId)?.razaoSocial ||
      (typeof row.client_name === "string" ? row.client_name : "Cliente não encontrado");
    const rawTasks = (row as { demand_tasks?: unknown }).demand_tasks;
    const tasksRaw = Array.isArray(rawTasks) ? rawTasks : [];
    const tarefas =
      tasksRaw?.map((t: Record<string, unknown>) => ({
        id: String(t.id),
        titulo: (t.titulo as string) || "",
        concluida: Boolean(t.concluida),
      })) || [];
    return {
      id: String(row.id),
      clientId,
      clientName,
      demanda: (row.demanda as string) || "",
      descricao: (row.descricao as string) || "",
      dataPedido: row.data_pedido ? new Date(row.data_pedido as string) : new Date(),
      dataEntrega: row.data_entrega ? new Date(row.data_entrega as string) : new Date(),
      horaEntrega: normalizeDeliveryTime(row.hora_entrega),
      responsavel: (row.responsavel as string) || "",
      status: normalizeStatus(row.status),
      prioridade: normalizePrioridade(row.prioridade),
      tarefas,
      createdAt: row.created_at ? new Date(row.created_at as string) : new Date(),
    };
  };

  const fetchDemands = async () => {
    setLoading(true);
    if (!user || isIsolated) {
      try {
        const raw = localStorage.getItem(storageKey);
        const parsed: Demand[] = raw ? JSON.parse(raw) : [];
        setDemands(
          parsed.map((d) => ({
            ...d,
            dataPedido: new Date(d.dataPedido),
            dataEntrega: new Date(d.dataEntrega),
            horaEntrega: normalizeDeliveryTime((d as Partial<Demand>).horaEntrega),
            createdAt: new Date(d.createdAt),
          }))
        );
      } catch {
        setDemands([]);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from("demands")
        .select("*, demand_tasks(*)")
        .order("data_entrega", { ascending: true });

      if (error) throw error;
      const mapped = (data || []).map(mapDemand);
      setDemands(mapped);
    } catch (err) {
      console.error("Erro ao carregar demandas", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDemands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients.length, isIsolated, storageKey]);

  const addDemand = async (data: DemandFormData) => {
    if (!user || isIsolated) {
      const newDemand: Demand = {
        id: safeId("demand"),
        clientId: data.clientId || "",
        clientName: clients.find((c) => c.id === data.clientId)?.razaoSocial || "Cliente não encontrado",
        demanda: data.demanda,
        descricao: data.descricao || "",
        dataPedido: data.dataPedido,
        dataEntrega: data.dataEntrega,
        horaEntrega: normalizeDeliveryTime(data.horaEntrega),
        responsavel: data.responsavel,
        status: data.status,
        prioridade: data.prioridade,
        tarefas: data.tarefas || [],
        createdAt: new Date(),
      };
      setDemands((prev) => {
        const next = [newDemand, ...prev];
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
      return;
    }
    try {
      const payload = {
        client_id: data.clientId || null,
        demanda: data.demanda,
        descricao: data.descricao || "",
        data_pedido: data.dataPedido.toISOString().split("T")[0],
        data_entrega: data.dataEntrega.toISOString().split("T")[0],
        hora_entrega: `${normalizeDeliveryTime(data.horaEntrega)}:00`,
        responsavel: data.responsavel,
        status: data.status,
        prioridade: data.prioridade,
        created_by: user?.id ?? null,
      };

      let inserted: { id: string } | null = null;
      let error: unknown = null;
      ({ data: inserted, error } = await supabase
        .from("demands")
        .insert(payload)
        .select("id")
        .single());

      if (error && hasMissingColumn(error, "hora_entrega")) {
        const fallbackPayload = {
          client_id: data.clientId || null,
          demanda: data.demanda,
          descricao: data.descricao || "",
          data_pedido: data.dataPedido.toISOString().split("T")[0],
          data_entrega: data.dataEntrega.toISOString().split("T")[0],
          responsavel: data.responsavel,
          status: data.status,
          prioridade: data.prioridade,
          created_by: user?.id ?? null,
        };
        ({ data: inserted, error } = await supabase
          .from("demands")
          .insert(fallbackPayload)
          .select("id")
          .single());
      }

      if (error) throw error;

      if (data.tarefas && data.tarefas.length > 0 && inserted) {
        const tasksPayload = data.tarefas.map((t) => ({
          demand_id: inserted.id,
          titulo: t.titulo,
          concluida: t.concluida ?? false,
        }));
        const { error: taskError } = await supabase.from("demand_tasks").insert(tasksPayload);
        if (taskError) throw taskError;
      }

      await fetchDemands();
    } catch (err) {
      console.error("Erro ao criar demanda", err);
      throw err;
    }
  };

  const removeDemand = async (id: string) => {
    if (!user || isIsolated) {
      setDemands((prev) => {
        const next = prev.filter((d) => d.id !== id);
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
      return;
    }
    try {
      const { error } = await supabase.from("demands").delete().eq("id", id);
      if (error) throw error;
      setDemands((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error("Erro ao remover demanda", err);
      throw err;
    }
  };

  const updateDemand = async (id: string, data: Partial<DemandFormData>) => {
    if (!user || isIsolated) {
      setDemands((prev) => {
        const next = prev.map((d) =>
          d.id === id
            ? {
                ...d,
                ...data,
                dataPedido: data.dataPedido ?? d.dataPedido,
                dataEntrega: data.dataEntrega ?? d.dataEntrega,
                horaEntrega: normalizeDeliveryTime(data.horaEntrega ?? d.horaEntrega),
                clientName: data.clientId ? clients.find((c) => c.id === data.clientId)?.razaoSocial || d.clientName : d.clientName,
                tarefas: data.tarefas ?? d.tarefas,
              }
            : d
        );
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
      return;
    }
    try {
      const payload: Record<string, unknown> = {};
      if (data.clientId !== undefined) payload.client_id = data.clientId || null;
      if (data.demanda !== undefined) payload.demanda = data.demanda;
      if (data.descricao !== undefined) payload.descricao = data.descricao;
      if (data.dataPedido) payload.data_pedido = data.dataPedido.toISOString().split("T")[0];
      if (data.dataEntrega) payload.data_entrega = data.dataEntrega.toISOString().split("T")[0];
      if (data.horaEntrega !== undefined) {
        payload.hora_entrega = `${normalizeDeliveryTime(data.horaEntrega)}:00`;
      }
      if (data.responsavel !== undefined) payload.responsavel = data.responsavel;
      if (data.status !== undefined) payload.status = data.status;
      if (data.prioridade !== undefined) payload.prioridade = data.prioridade;

      if (Object.keys(payload).length > 0) {
        let { error } = await supabase.from("demands").update(payload).eq("id", id);
        if (error && hasMissingColumn(error, "hora_entrega")) {
          const fallbackPayload = { ...payload };
          delete fallbackPayload.hora_entrega;
          ({ error } = await supabase.from("demands").update(fallbackPayload).eq("id", id));
        }
        if (error) throw error;
      }

      // Recria checklist para manter consistência
      if (data.tarefas) {
        await supabase.from("demand_tasks").delete().eq("demand_id", id);
        if (data.tarefas.length > 0) {
          const { error: taskError } = await supabase.from("demand_tasks").insert(
            data.tarefas.map((t) => ({
              demand_id: id,
              titulo: t.titulo,
              concluida: t.concluida ?? false,
            }))
          );
          if (taskError) throw taskError;
        }
      }

      await fetchDemands();
    } catch (err) {
      console.error("Erro ao atualizar demanda", err);
      throw err;
    }
  };

  const toggleTask = async (demandId: string, taskId: string) => {
    if (!user || isIsolated) {
      setDemands((prev) => {
        const next = prev.map((d) =>
          d.id === demandId
            ? {
                ...d,
                tarefas: d.tarefas.map((t) => (t.id === taskId ? { ...t, concluida: !t.concluida } : t)),
              }
            : d
        );
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
      return;
    }
    try {
      const demand = demands.find((d) => d.id === demandId);
      const task = demand?.tarefas.find((t) => t.id === taskId);
      const next = task ? !task.concluida : false;
      const { error } = await supabase.from("demand_tasks").update({ concluida: next }).eq("id", taskId);
      if (error) throw error;
      setDemands((prev) =>
        prev.map((d) =>
          d.id === demandId
            ? { ...d, tarefas: d.tarefas.map((t) => (t.id === taskId ? { ...t, concluida: next } : t)) }
            : d
        )
      );
    } catch (err) {
      console.error("Erro ao alternar tarefa", err);
      throw err;
    }
  };

  const addTask = async (demandId: string, titulo: string) => {
    if (!user || isIsolated) {
      const newTask = { id: safeId("task"), titulo, concluida: false };
      setDemands((prev) =>
        prev.map((d) =>
          d.id === demandId ? { ...d, tarefas: [...d.tarefas, newTask] } : d
        )
      );
      const next = demands.map((d) =>
        d.id === demandId ? { ...d, tarefas: [...d.tarefas, newTask] } : d
      );
      localStorage.setItem(storageKey, JSON.stringify(next));
      return;
    }
    try {
      const { data, error } = await supabase
        .from("demand_tasks")
        .insert({ demand_id: demandId, titulo, concluida: false })
        .select("*")
        .single();

      if (error) throw error;

      setDemands((prev) =>
        prev.map((d) =>
          d.id === demandId
            ? { ...d, tarefas: [...d.tarefas, { id: data.id, titulo: data.titulo, concluida: data.concluida }] }
            : d
        )
      );
    } catch (err) {
      console.error("Erro ao adicionar tarefa", err);
      throw err;
    }
  };

  const getDemandsByStatus = (status: DemandStatus) => demands.filter((d) => d.status === status);

  return (
    <DemandContext.Provider
      value={{ demands, loading, addDemand, removeDemand, updateDemand, toggleTask, addTask, getDemandsByStatus }}
    >
      {children}
    </DemandContext.Provider>
  );
}

export function useDemands() {
  const context = useContext(DemandContext);
  if (!context) throw new Error("useDemands must be used within a DemandProvider");
  return context;
}
