export interface TaskItem {
  id: string;
  titulo: string;
  concluida: boolean;
}

export interface Demand {
  id: string;
  clientId: string;
  clientName: string;
  demanda: string;
  descricao: string;
  dataPedido: Date;
  dataEntrega: Date;
  horaEntrega: string;
  responsavel: string;
  status: "pendente" | "em_andamento" | "concluida" | "atrasada";
  prioridade: "baixa" | "media" | "alta" | "urgente";
  tarefas: TaskItem[];
  createdAt: Date;
}

export type DemandStatus = Demand["status"];
export type DemandPrioridade = Demand["prioridade"];

export type DemandFormData = Omit<Demand, "id" | "createdAt" | "clientName">;

export const statusOptions = [
  { value: "pendente", label: "Pendente", color: "bg-yellow-500/20 text-yellow-400" },
  { value: "em_andamento", label: "Em Andamento", color: "bg-blue-500/20 text-blue-400" },
  { value: "concluida", label: "Concluída", color: "bg-primary/15 text-primary" },
  { value: "atrasada", label: "Atrasada", color: "bg-red-500/20 text-red-400" },
] as const;

export const prioridadeOptions = [
  { value: "baixa", label: "Baixa", color: "bg-slate-500/20 text-slate-400" },
  { value: "media", label: "Média", color: "bg-blue-500/20 text-blue-400" },
  { value: "alta", label: "Alta", color: "bg-orange-500/20 text-orange-400" },
  { value: "urgente", label: "Urgente", color: "bg-red-500/20 text-red-400" },
] as const;
