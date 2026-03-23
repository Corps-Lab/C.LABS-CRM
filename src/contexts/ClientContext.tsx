import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import {
  Client,
  ClientFormData,
  ClientStatus,
  isClientStatus,
  normalizeClientStatus,
} from "@/types/client";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { useAgency } from "./AgencyContext";

interface ClientContextType {
  clients: Client[];
  loading: boolean;
  addClient: (data: ClientFormData) => Promise<void>;
  removeClient: (id: string) => Promise<void>;
  updateClient: (id: string, data: ClientFormData) => Promise<void>;
  totalFaturamento: number;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

function mapClientRow(row: any, statusOverride?: ClientStatus): Client {
  const valorPago = Number(row.valor_pago || 0);
  const statusFromRow = isClientStatus(row.status) ? row.status : undefined;
  return {
    id: row.id,
    razaoSocial: row.razao_social,
    nomeFantasia: row.nome_fantasia || "",
    cnpj: row.cnpj,
    endereco: row.endereco || "",
    valorPago,
    recorrencia: row.recorrencia,
    status: normalizeClientStatus(statusFromRow || statusOverride, row.cnpj, valorPago),
    responsavel: row.responsavel || "",
    contatoInterno: row.contato_interno || "",
    createdAt: new Date(row.created_at),
  };
}

function hasMissingColumn(err: unknown, column: string): boolean {
  if (!err || typeof err !== "object") return false;
  const message = "message" in err ? String(err.message || "") : "";
  return message.toLowerCase().includes(column.toLowerCase()) && message.toLowerCase().includes("column");
}

export function ClientProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { isIsolated, currentAgency } = useAgency();
  const storageKey = useMemo(() => `crm_${currentAgency.id}_clients`, [currentAgency.id]);
  const statusOverridesKey = useMemo(
    () => `crm_${currentAgency.id}_client_status_overrides_${user?.id ?? "anon"}`,
    [currentAgency.id, user?.id]
  );
  const nomeFantasiaOverridesKey = useMemo(
    () => `crm_${currentAgency.id}_client_nome_fantasia_overrides_${user?.id ?? "anon"}`,
    [currentAgency.id, user?.id]
  );

  const readStatusOverrides = (): Record<string, ClientStatus> => {
    try {
      const raw = localStorage.getItem(statusOverridesKey);
      const parsed = raw ? JSON.parse(raw) : {};
      if (!parsed || typeof parsed !== "object") return {};
      return Object.fromEntries(
        Object.entries(parsed).filter(
          (entry): entry is [string, ClientStatus] => isClientStatus(entry[1] as string)
        )
      );
    } catch {
      return {};
    }
  };

  const writeStatusOverride = (id: string, status: ClientStatus) => {
    try {
      const prev = readStatusOverrides();
      localStorage.setItem(statusOverridesKey, JSON.stringify({ ...prev, [id]: status }));
    } catch {
      // ignore storage errors
    }
  };

  const removeStatusOverride = (id: string) => {
    try {
      const prev = readStatusOverrides();
      if (!(id in prev)) return;
      delete prev[id];
      localStorage.setItem(statusOverridesKey, JSON.stringify(prev));
    } catch {
      // ignore storage errors
    }
  };

  const readNomeFantasiaOverrides = (): Record<string, string> => {
    try {
      const raw = localStorage.getItem(nomeFantasiaOverridesKey);
      const parsed = raw ? JSON.parse(raw) : {};
      if (!parsed || typeof parsed !== "object") return {};
      return Object.fromEntries(
        Object.entries(parsed).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        )
      );
    } catch {
      return {};
    }
  };

  const writeNomeFantasiaOverride = (id: string, nomeFantasia: string) => {
    try {
      const prev = readNomeFantasiaOverrides();
      localStorage.setItem(nomeFantasiaOverridesKey, JSON.stringify({ ...prev, [id]: nomeFantasia || "" }));
    } catch {
      // ignore storage errors
    }
  };

  const removeNomeFantasiaOverride = (id: string) => {
    try {
      const prev = readNomeFantasiaOverrides();
      if (!(id in prev)) return;
      delete prev[id];
      localStorage.setItem(nomeFantasiaOverridesKey, JSON.stringify(prev));
    } catch {
      // ignore storage errors
    }
  };

  // Carrega clientes do Supabase
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      // Modo isolado ou sem login → usar storage local separado por agência
      if (!user || isIsolated) {
        try {
          const raw = localStorage.getItem(storageKey);
          const parsed: Client[] = raw ? JSON.parse(raw) : [];
          setClients(
            parsed.map((client) => ({
              ...client,
              nomeFantasia: client.nomeFantasia || "",
              status: normalizeClientStatus(client.status, client.cnpj, client.valorPago),
            }))
          );
        } catch {
          setClients([]);
        } finally {
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from("clients")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        const overrides = readStatusOverrides();
        const nomeFantasiaOverrides = readNomeFantasiaOverrides();
        const mapped =
          data?.map((c) => ({
            ...mapClientRow(c, overrides[c.id]),
            nomeFantasia: c.nome_fantasia || nomeFantasiaOverrides[c.id] || "",
          })) || [];
        setClients(mapped);
      } catch (err) {
        console.error("Erro ao carregar clientes", err);
        setClients([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, isIsolated, storageKey, statusOverridesKey, nomeFantasiaOverridesKey]);

  const addClient = async (data: ClientFormData) => {
    // Modo mock: apenas grava localmente
    if (!user || isIsolated) {
      const newClient: Client = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
        razaoSocial: data.razaoSocial,
        nomeFantasia: data.nomeFantasia || "",
        cnpj: data.cnpj,
        endereco: data.endereco,
        valorPago: data.valorPago,
        recorrencia: data.recorrencia,
        status: data.status,
        responsavel: data.responsavel,
        contatoInterno: data.contatoInterno,
        createdAt: new Date(),
      };
      setClients((prev) => {
        const next = [newClient, ...prev];
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
      return;
    }

    const payload = {
      razao_social: data.razaoSocial,
      nome_fantasia: data.nomeFantasia || null,
      cnpj: data.cnpj,
      endereco: data.endereco,
      valor_pago: data.valorPago,
      recorrencia: data.recorrencia,
      status: data.status,
      responsavel: data.responsavel,
      contato_interno: data.contatoInterno,
    };
    let inserted: any = null;
    let error: any = null;
    ({ data: inserted, error } = await supabase.from("clients").insert(payload).select().single());
    if (
      error &&
      (hasMissingColumn(error, "status") || hasMissingColumn(error, "nome_fantasia"))
    ) {
      const fallbackPayload: Record<string, unknown> = {
        razao_social: data.razaoSocial,
        cnpj: data.cnpj,
        endereco: data.endereco,
        valor_pago: data.valorPago,
        recorrencia: data.recorrencia,
        responsavel: data.responsavel,
        contato_interno: data.contatoInterno,
      };
      ({ data: inserted, error } = await supabase
        .from("clients")
        .insert(fallbackPayload)
        .select()
        .single());
      if (inserted) {
        inserted.status = inserted.status || data.status;
        inserted.nome_fantasia = inserted.nome_fantasia || data.nomeFantasia || null;
      }
    }
    if (error) throw error;
    const mapped: Client = mapClientRow(inserted);
    writeStatusOverride(mapped.id, mapped.status);
    writeNomeFantasiaOverride(mapped.id, mapped.nomeFantasia || data.nomeFantasia || "");
    setClients((prev) => [mapped, ...prev]);
  };

  const removeClient = async (id: string) => {
    if (!user || isIsolated) {
      setClients((prev) => {
        const next = prev.filter((client) => client.id !== id);
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
      removeStatusOverride(id);
      removeNomeFantasiaOverride(id);
      return;
    }
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) throw error;
    setClients((prev) => prev.filter((client) => client.id !== id));
    removeStatusOverride(id);
    removeNomeFantasiaOverride(id);
  };

  const updateClient = async (id: string, data: ClientFormData) => {
    if (!user || isIsolated) {
      setClients((prev) => {
        const next = prev.map((client) =>
          client.id === id
            ? {
                ...client,
                razaoSocial: data.razaoSocial,
                nomeFantasia: data.nomeFantasia || "",
                cnpj: data.cnpj,
                endereco: data.endereco,
                valorPago: data.valorPago,
                recorrencia: data.recorrencia,
                status: data.status,
                responsavel: data.responsavel,
                contatoInterno: data.contatoInterno,
              }
            : client
        );
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
      return;
    }

    let updated: any = null;
    let error: any = null;
    ({ data: updated, error } = await supabase
      .from("clients")
      .update({
        razao_social: data.razaoSocial,
        nome_fantasia: data.nomeFantasia || null,
        cnpj: data.cnpj,
        endereco: data.endereco,
        valor_pago: data.valorPago,
        recorrencia: data.recorrencia,
        status: data.status,
        responsavel: data.responsavel,
        contato_interno: data.contatoInterno,
      })
      .eq("id", id)
      .select()
      .single());
    if (
      error &&
      (hasMissingColumn(error, "status") || hasMissingColumn(error, "nome_fantasia"))
    ) {
      const fallbackPayload: Record<string, unknown> = {
        razao_social: data.razaoSocial,
        cnpj: data.cnpj,
        endereco: data.endereco,
        valor_pago: data.valorPago,
        recorrencia: data.recorrencia,
        responsavel: data.responsavel,
        contato_interno: data.contatoInterno,
      };
      ({ data: updated, error } = await supabase
        .from("clients")
        .update(fallbackPayload)
        .eq("id", id)
        .select()
        .single());
      if (updated) {
        updated.status = updated.status || data.status;
        updated.nome_fantasia = updated.nome_fantasia || data.nomeFantasia || null;
      }
    }
    if (error) throw error;
    writeNomeFantasiaOverride(updated.id, updated.nome_fantasia || data.nomeFantasia || "");
    writeStatusOverride(updated.id, normalizeClientStatus(updated.status || data.status, updated.cnpj, Number(updated.valor_pago || 0)));
    setClients((prev) =>
      prev.map((client) =>
        client.id === id ? mapClientRow(updated) : client
      )
    );
  };

  const totalFaturamento = clients.reduce((acc, client) => {
    const multiplier = {
      mensal: 1,
      trimestral: 1 / 3,
      semestral: 1 / 6,
      anual: 1 / 12,
    };
    return acc + client.valorPago * multiplier[client.recorrencia];
  }, 0);

  return (
    <ClientContext.Provider
      value={{ clients, loading, addClient, removeClient, updateClient, totalFaturamento }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export function useClients() {
  const context = useContext(ClientContext);
  if (!context) {
    throw new Error("useClients must be used within a ClientProvider");
  }
  return context;
}
