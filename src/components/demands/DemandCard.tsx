import { Demand, statusOptions, prioridadeOptions } from "@/types/demand";
import { useDemands } from "@/contexts/DemandContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format, isToday, isTomorrow, isPast, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Edit2, Trash2, Calendar, User, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface DemandCardProps {
  demand: Demand;
  onEdit: (demand: Demand) => void;
  onDelete: (id: string) => void;
}

export function DemandCard({ demand, onEdit, onDelete }: DemandCardProps) {
  const { toggleTask } = useDemands();
  const [expanded, setExpanded] = useState(false);

  const completedTasks = demand.tarefas.filter((t) => t.concluida).length;
  const totalTasks = demand.tarefas.length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const statusInfo = statusOptions.find((s) => s.value === demand.status);
  const prioridadeInfo = prioridadeOptions.find((p) => p.value === demand.prioridade);

  const entrega = new Date(demand.dataEntrega);
  const normalizedHour = /^\d{2}:\d{2}$/.test(demand.horaEntrega || "")
    ? demand.horaEntrega
    : "18:00";
  const [entregaHour, entregaMinute] = normalizedHour.split(":").map(Number);
  const entregaDateTime = new Date(entrega);
  entregaDateTime.setHours(entregaHour, entregaMinute, 0, 0);
  const daysUntil = differenceInDays(entrega, new Date());

  const getDeadlineText = () => {
    if (isPast(entregaDateTime) && demand.status !== "concluida") return "Atrasado";
    if (isToday(entrega)) return `Hoje ${normalizedHour}`;
    if (isTomorrow(entrega)) return `Amanhã ${normalizedHour}`;
    if (daysUntil <= 7) return `${daysUntil} dias`;
    return `${format(entrega, "dd/MM", { locale: ptBR })} ${normalizedHour}`;
  };

  const getDeadlineColor = () => {
    if (isPast(entregaDateTime) && demand.status !== "concluida") return "text-red-400";
    if (isToday(entrega) || isTomorrow(entrega)) return "text-orange-400";
    return "text-muted-foreground";
  };

  return (
    <Card className="bg-card border-border hover:border-primary/30 transition-all">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold text-foreground truncate">
              {demand.demanda}
            </CardTitle>
            <p className="text-sm text-muted-foreground truncate">{demand.clientName}</p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(demand)}>
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => onDelete(demand.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          <span className={cn("px-2 py-0.5 rounded text-xs font-medium", statusInfo?.color)}>
            {statusInfo?.label}
          </span>
          <span className={cn("px-2 py-0.5 rounded text-xs font-medium", prioridadeInfo?.color)}>
            {prioridadeInfo?.label}
          </span>
        </div>

        {/* Info Row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            <span>{demand.responsavel}</span>
          </div>
          <div className={cn("flex items-center gap-1", getDeadlineColor())}>
            <Clock className="w-3.5 h-3.5" />
            <span>{getDeadlineText()}</span>
          </div>
        </div>

        {/* Progress */}
        {totalTasks > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progresso</span>
              <span className="text-primary font-medium">{completedTasks}/{totalTasks}</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}

        {/* Expandable Tasks */}
        {totalTasks > 0 && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "Ocultar tarefas" : "Ver tarefas"}
            </button>

            {expanded && (
              <div className="mt-2 space-y-1.5 pl-1">
                {demand.tarefas.map((tarefa) => (
                  <div key={tarefa.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={tarefa.concluida}
                      onCheckedChange={() => toggleTask(demand.id, tarefa.id)}
                      className="h-4 w-4"
                    />
                    <span
                      className={cn(
                        "text-xs",
                        tarefa.concluida && "line-through text-muted-foreground"
                      )}
                    >
                      {tarefa.titulo}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Dates */}
        <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>Pedido: {format(new Date(demand.dataPedido), "dd/MM/yy")}</span>
          </div>
          <div className={cn("flex items-center gap-1", getDeadlineColor())}>
            <Calendar className="w-3 h-3" />
            <span>Entrega: {format(entrega, "dd/MM/yy")} {normalizedHour}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
