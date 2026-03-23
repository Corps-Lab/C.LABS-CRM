import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DemandFormData, TaskItem, statusOptions, prioridadeOptions } from "@/types/demand";
import { useClients } from "@/contexts/ClientContext";
import { useAgency } from "@/contexts/AgencyContext";
import { useAuth } from "@/contexts/AuthContext";
import { safeId } from "@/lib/safeId";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Plus, Trash2, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

const demandSchema = z.object({
  clientId: z.string().min(1, "Selecione um cliente"),
  demanda: z.string().trim().min(3, "Demanda deve ter no mínimo 3 caracteres"),
  descricao: z.string().trim().optional(),
  dataPedido: z.date(),
  dataEntrega: z.date(),
  horaEntrega: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Informe um horário válido"),
  responsavel: z.string().trim().min(2, "Informe o responsável"),
  status: z.enum(["pendente", "em_andamento", "concluida", "atrasada"]),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]),
});

type DemandSchemaType = z.infer<typeof demandSchema>;
type ResponsavelOption = { value: string; label: string; role?: string };
const ALLOWED_DEMAND_RESPONSIBLE_ROLES = ["colaborador", "ceo"] as const;

interface DemandFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: DemandFormData) => Promise<void>;
  defaultValues?: Partial<DemandFormData>;
  isEdit?: boolean;
}

export function DemandForm({
  open,
  onClose,
  onSubmit,
  defaultValues,
  isEdit = false,
}: DemandFormProps) {
  const { toast } = useToast();
  const { clients } = useClients();
  const { currentAgency, isIsolated } = useAgency();
  const { profile, role } = useAuth();
  const [tarefas, setTarefas] = useState<TaskItem[]>(defaultValues?.tarefas || []);
  const [novaTarefa, setNovaTarefa] = useState("");
  const [responsavelOptions, setResponsavelOptions] = useState<ResponsavelOption[]>([]);
  const [loadingResponsaveis, setLoadingResponsaveis] = useState(false);
  const safeClients = useMemo(
    () =>
      clients
        .filter((client) => client.id && client.id.trim().length > 0)
        .map((client) => ({ ...client, id: client.id.trim() })),
    [clients]
  );

  const normalizeDemandStatus = (value?: string): DemandSchemaType["status"] => {
    if (value === "pendente" || value === "em_andamento" || value === "concluida" || value === "atrasada") {
      return value;
    }
    if (value === "em-andamento" || value === "em andamento" || value === "andamento") {
      return "em_andamento";
    }
    if (value === "concluída") {
      return "concluida";
    }
    return "pendente";
  };

  const normalizeDemandPriority = (value?: string): DemandSchemaType["prioridade"] => {
    if (value === "baixa" || value === "media" || value === "alta" || value === "urgente") {
      return value;
    }
    if (value === "média" || value === "Media") return "media";
    if (value === "Alta") return "alta";
    if (value === "Baixa") return "baixa";
    if (value === "Urgente") return "urgente";
    return "media";
  };

  const normalizeDeliveryTime = (value?: string) => {
    if (!value) return "18:00";
    const match = value.match(/^(\d{2}):(\d{2})/);
    if (match) {
      const hour = Number(match[1]);
      const minute = Number(match[2]);
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      }
    }
    return "18:00";
  };

  const toFormDefaults = (values?: Partial<DemandFormData>): DemandSchemaType => {
    const status = typeof values?.status === "string" ? values.status : undefined;
    const prioridade = typeof values?.prioridade === "string" ? values.prioridade : undefined;
    const clientId = typeof values?.clientId === "string" ? values.clientId.trim() : "";
    return {
      clientId,
      demanda: values?.demanda || "",
      descricao: values?.descricao || "",
      dataPedido: values?.dataPedido ? new Date(values.dataPedido) : new Date(),
      dataEntrega: values?.dataEntrega ? new Date(values.dataEntrega) : new Date(),
      horaEntrega: normalizeDeliveryTime(values?.horaEntrega),
      responsavel: values?.responsavel || "",
      status: normalizeDemandStatus(status),
      prioridade: normalizeDemandPriority(prioridade),
    };
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<DemandSchemaType>({
    resolver: zodResolver(demandSchema),
    defaultValues: toFormDefaults(defaultValues),
  });

  useEffect(() => {
    if (open) {
      reset(toFormDefaults(defaultValues));
      setTarefas(defaultValues?.tarefas || []);
      setNovaTarefa("");
    }
  }, [defaultValues, open, reset]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const loadResponsaveis = async () => {
      setLoadingResponsaveis(true);
      try {
        if (isIsolated) {
          const localUsersKey = `crm_${currentAgency.id}_users`;
          const raw = localStorage.getItem(localUsersKey);
          const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
          const next = parsed
            .filter((u) => {
              const nome = typeof u.nome === "string" ? u.nome.trim() : "";
              const tipo = typeof u.role === "string" ? u.role : "";
              return nome.length > 0 && ALLOWED_DEMAND_RESPONSIBLE_ROLES.includes(tipo as (typeof ALLOWED_DEMAND_RESPONSIBLE_ROLES)[number]);
            })
            .map((u) => {
              const nome = String(u.nome).trim();
              const tipo = String(u.role);
              const roleLabel =
                tipo === "ceo" ? "CEO" : tipo === "admin" ? "Admin" : "Colaborador";
              return { value: nome, label: `${nome} (${roleLabel})`, role: tipo };
            });
          const unique = Array.from(new Map(next.map((item) => [item.value, item])).values()).sort(
            (a, b) => a.label.localeCompare(b.label, "pt-BR")
          );
          if (!cancelled) setResponsavelOptions(unique);
          return;
        }

        const [profilesResp, rolesResp] = await Promise.all([
          supabase.from("profiles").select("*"),
          supabase.from("user_roles").select("user_id, role"),
        ]);

        if (profilesResp.error) throw profilesResp.error;
        if (rolesResp.error) throw rolesResp.error;

        const roleMap = new Map(
          (rolesResp.data || []).map((r) => [r.user_id, r.role as string | undefined])
        );

        const optionsMap = new Map<string, ResponsavelOption>();
        for (const row of (profilesResp.data || []) as Array<Record<string, unknown>>) {
          const nome = typeof row.nome === "string" ? row.nome.trim() : "";
          const userId = typeof row.user_id === "string" ? row.user_id : "";
          if (!nome) continue;
          const profileRole = typeof row.nivel_acesso === "string" ? row.nivel_acesso : undefined;
          const userRole = roleMap.get(userId);
          const finalRole = profileRole || userRole;
          if (
            finalRole &&
            !ALLOWED_DEMAND_RESPONSIBLE_ROLES.includes(
              finalRole as (typeof ALLOWED_DEMAND_RESPONSIBLE_ROLES)[number]
            )
          ) {
            continue;
          }
          const roleLabel =
            finalRole === "ceo"
              ? "CEO"
              : finalRole === "colaborador"
              ? "Colaborador"
              : "Equipe";
          optionsMap.set(nome, { value: nome, label: `${nome} (${roleLabel})`, role: finalRole });
        }

        if (profile?.nome?.trim()) {
          const currentName = profile.nome.trim();
          if (!optionsMap.has(currentName)) {
            const currentRole = role || profile.nivel_acesso || "colaborador";
            if (
              ALLOWED_DEMAND_RESPONSIBLE_ROLES.includes(
                currentRole as (typeof ALLOWED_DEMAND_RESPONSIBLE_ROLES)[number]
              )
            ) {
              const roleLabel =
                currentRole === "ceo"
                  ? "CEO"
                  : "Colaborador";
              optionsMap.set(currentName, {
                value: currentName,
                label: `${currentName} (${roleLabel})`,
                role: currentRole,
              });
            }
          }
        }

        const next = Array.from(optionsMap.values()).sort((a, b) =>
          a.label.localeCompare(b.label, "pt-BR")
        );
        if (!cancelled) setResponsavelOptions(next);
      } catch (error) {
        console.error("Erro ao carregar responsáveis", error);
        if (!cancelled) {
          const fallbackName = profile?.nome?.trim();
          setResponsavelOptions(
            fallbackName
              ? [{
                  value: fallbackName,
                  label: `${fallbackName} (${role === "ceo" ? "CEO" : "Colaborador"})`,
                }]
              : []
          );
        }
      } finally {
        if (!cancelled) setLoadingResponsaveis(false);
      }
    };

    loadResponsaveis();
    return () => {
      cancelled = true;
    };
  }, [open, isIsolated, currentAgency.id, profile?.nome, profile?.nivel_acesso, role]);

  const watchedClientId = (watch("clientId") || "").trim();
  const watchedStatus = normalizeDemandStatus(watch("status"));
  const watchedPrioridade = normalizeDemandPriority(watch("prioridade"));
  const watchedResponsavel = (watch("responsavel") || "").trim();
  const missingClientOption =
    watchedClientId &&
    !safeClients.some((client) => client.id === watchedClientId)
      ? {
          id: watchedClientId,
          razaoSocial: "Cliente vinculado (não encontrado)",
        }
      : null;
  const missingResponsavelOption =
    watchedResponsavel &&
    !responsavelOptions.some((option) => option.value === watchedResponsavel)
      ? {
          value: watchedResponsavel,
          label: `${watchedResponsavel} (responsável atual)`,
        }
      : null;

  const handleFormSubmit = async (data: DemandSchemaType) => {
    const formData: DemandFormData = {
      clientId: data.clientId,
      demanda: data.demanda,
      descricao: data.descricao || "",
      dataPedido: data.dataPedido,
      dataEntrega: data.dataEntrega,
      horaEntrega: data.horaEntrega,
      responsavel: data.responsavel,
      status: data.status,
      prioridade: data.prioridade,
      tarefas,
    };
    await onSubmit(formData);
    toast({
      title: isEdit ? "Demanda atualizada!" : "Demanda criada!",
      description: data.demanda,
    });
    reset();
    setTarefas([]);
    onClose();
  };

  const addTarefa = () => {
    if (novaTarefa.trim()) {
      setTarefas([
        ...tarefas,
        { id: safeId("task"), titulo: novaTarefa.trim(), concluida: false },
      ]);
      setNovaTarefa("");
    }
  };

  const removeTarefa = (id: string) => {
    setTarefas(tarefas.filter((t) => t.id !== id));
  };

  const toggleTarefa = (id: string) => {
    setTarefas(
      tarefas.map((t) => (t.id === id ? { ...t, concluida: !t.concluida } : t))
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary">
            {isEdit ? "Editar Demanda" : "Nova Demanda"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Cliente */}
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Select
              value={watchedClientId}
              onValueChange={(value) => setValue("clientId", value)}
            >
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {missingClientOption && (
                  <SelectItem value={missingClientOption.id}>
                    {missingClientOption.razaoSocial}
                  </SelectItem>
                )}
                {safeClients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.razaoSocial}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.clientId && (
              <p className="text-sm text-destructive">{errors.clientId.message}</p>
            )}
          </div>

          {/* Demanda */}
          <div className="space-y-2">
            <Label htmlFor="demanda">Demanda *</Label>
            <Input
              id="demanda"
              placeholder="Título da demanda"
              {...register("demanda")}
              className="bg-secondary border-border"
            />
            {errors.demanda && (
              <p className="text-sm text-destructive">{errors.demanda.message}</p>
            )}
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              placeholder="Detalhes da demanda"
              {...register("descricao")}
              className="bg-secondary border-border min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Data Pedido */}
            <div className="space-y-2">
              <Label>Data do Pedido *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-secondary border-border",
                      !watch("dataPedido") && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {watch("dataPedido")
                      ? format(watch("dataPedido"), "dd/MM/yyyy", { locale: ptBR })
                      : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={watch("dataPedido")}
                    onSelect={(date) => date && setValue("dataPedido", date)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Data Entrega */}
            <div className="space-y-2">
              <Label>Data de Entrega *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-secondary border-border",
                      !watch("dataEntrega") && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {watch("dataEntrega")
                      ? format(watch("dataEntrega"), "dd/MM/yyyy", { locale: ptBR })
                      : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={watch("dataEntrega")}
                    onSelect={(date) => date && setValue("dataEntrega", date)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Horário de Entrega */}
            <div className="space-y-2">
              <Label htmlFor="horaEntrega">Horário de Entrega *</Label>
              <Input
                id="horaEntrega"
                type="time"
                step="60"
                {...register("horaEntrega")}
                className="bg-secondary border-border"
              />
              {errors.horaEntrega && (
                <p className="text-sm text-destructive">{errors.horaEntrega.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Responsável */}
            <div className="space-y-2">
              <Label>Responsável *</Label>
              <input type="hidden" {...register("responsavel")} />
              <Select
                value={watchedResponsavel}
                onValueChange={(value) =>
                  setValue("responsavel", value, { shouldValidate: true, shouldDirty: true })
                }
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder={loadingResponsaveis ? "Carregando responsáveis..." : "Selecione o responsável"} />
                </SelectTrigger>
                <SelectContent>
                  {missingResponsavelOption && (
                    <SelectItem value={missingResponsavelOption.value}>
                      {missingResponsavelOption.label}
                    </SelectItem>
                  )}
                  {responsavelOptions.map((option) => (
                    <SelectItem key={`${option.value}-${option.role ?? "na"}`} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.responsavel && (
                <p className="text-sm text-destructive">{errors.responsavel.message}</p>
              )}
            </div>

            {/* Prioridade */}
            <div className="space-y-2">
              <Label>Prioridade *</Label>
              <Select
                value={watchedPrioridade}
                onValueChange={(value) =>
                  setValue("prioridade", value as DemandSchemaType["prioridade"])
                }
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {prioridadeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status *</Label>
            <Select
              value={watchedStatus}
              onValueChange={(value) =>
                setValue("status", value as DemandSchemaType["status"])
              }
            >
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Checklist de Tarefas */}
          <div className="space-y-3 p-4 rounded-lg bg-secondary/30 border border-border">
            <div className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-primary" />
              <Label className="text-base font-medium">Checklist de Tarefas</Label>
            </div>

            {/* Add Task */}
            <div className="flex gap-2">
              <Input
                placeholder="Nova tarefa..."
                value={novaTarefa}
                onChange={(e) => setNovaTarefa(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTarefa())}
                className="bg-card border-border"
              />
              <Button type="button" size="icon" onClick={addTarefa}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Task List */}
            <div className="space-y-2 max-h-[150px] overflow-y-auto">
              {tarefas.map((tarefa) => (
                <div
                  key={tarefa.id}
                  className="flex items-center justify-between p-2 rounded bg-card group"
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={tarefa.concluida}
                      onCheckedChange={() => toggleTarefa(tarefa.id)}
                    />
                    <span
                      className={cn(
                        "text-sm",
                        tarefa.concluida && "line-through text-muted-foreground"
                      )}
                    >
                      {tarefa.titulo}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={() => removeTarefa(tarefa.id)}
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              ))}
              {tarefas.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Nenhuma tarefa adicionada
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">{isEdit ? "Salvar" : "Criar Demanda"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
