import { useState } from "react";
import { Client, clientStatusOptions, normalizeClientStatus } from "@/types/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Edit2, Trash2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientTableProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
  onView: (client: Client) => void;
}

export function ClientTable({ clients, onEdit, onDelete, onView }: ClientTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const recorrenciaLabel: Record<string, string> = {
    mensal: "Mensal",
    trimestral: "Trimestral",
    semestral: "Semestral",
    anual: "Anual",
  };

  const statusClassName: Record<string, string> = {
    ativo: "bg-primary/15 text-primary border-primary/30",
    inativo: "bg-destructive/10 text-destructive border-destructive/30",
    prospect: "bg-muted text-muted-foreground border-border",
    inadimplente: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  };
  const statusLabel: Record<string, string> = Object.fromEntries(
    clientStatusOptions.map((status) => [status.value, status.label])
  );

  const formatDate = (value: Date) => {
    const date = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat("pt-BR").format(date);
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground text-lg">Nenhum cliente cadastrado</p>
        <p className="text-muted-foreground text-sm mt-1">
          Clique em "Novo Cliente" para começar
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
              <TableHead className="w-[72px] text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">ID</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Empresa</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">CNPJ / Responsável</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Contato</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Criado em</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client, index) => (
              <TableRow
                key={client.id}
                className={cn(
                  "transition-colors hover:bg-secondary/30",
                  index % 2 === 0 ? "bg-card" : "bg-card/50"
                )}
              >
                <TableCell className="font-mono text-xs text-muted-foreground">
                  #{client.id.slice(0, 4)}
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  <div className="space-y-0.5">
                    <p>{client.razaoSocial}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(client.valorPago)} • {recorrenciaLabel[client.recorrencia]}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="space-y-0.5">
                    <p>{client.cnpj || "—"}</p>
                    <p className="text-xs">{client.responsavel || "Sem responsável"}</p>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {client.contatoInterno || "Sem contato interno"}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2 py-1 text-xs font-medium uppercase tracking-wide",
                      statusClassName[normalizeClientStatus(client.status, client.cnpj, client.valorPago)]
                    )}
                  >
                    {statusLabel[normalizeClientStatus(client.status, client.cnpj, client.valorPago)]}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(client.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onView(client)}
                      className="h-8 w-8 rounded-md border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(client)}
                      className="h-8 w-8 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(client.id)}
                      className="h-8 w-8 rounded-md border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
