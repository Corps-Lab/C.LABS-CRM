import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ClientForm } from "@/components/clients/ClientForm";
import { ClientTable } from "@/components/clients/ClientTable";
import { ClientDetails } from "@/components/clients/ClientDetails";
import { useClients } from "@/contexts/ClientContext";
import { Client, ClientFormData } from "@/types/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Users, UserCheck2, UserX2, UserPlus2, Filter, Eraser } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ClientStatusFilter = "todos" | "ativos" | "inativos" | "prospectos";
type ClientRecorrenciaFilter = "todas" | "mensal" | "trimestral" | "semestral" | "anual";

function getClientStatus(client: Client): Exclude<ClientStatusFilter, "todos"> {
  if (!client.cnpj || client.cnpj.trim().length < 5) return "prospectos";
  if (client.valorPago <= 0) return "inativos";
  return "ativos";
}

export default function Clientes() {
  const { clients, addClient, removeClient, updateClient, totalFaturamento, loading } = useClients();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientStatusFilter>("todos");
  const [recorrenciaFilter, setRecorrenciaFilter] = useState<ClientRecorrenciaFilter>("todas");
  const { toast } = useToast();

  const totalClients = clients.length;
  const activeClients = clients.filter((client) => getClientStatus(client) === "ativos").length;
  const inactiveClients = clients.filter((client) => getClientStatus(client) === "inativos").length;
  const prospectClients = clients.filter((client) => getClientStatus(client) === "prospectos").length;

  const filteredClients = clients.filter(
    (client) => {
      const searchMatch =
        client.razaoSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.cnpj.includes(searchTerm) ||
        client.responsavel.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.contatoInterno.toLowerCase().includes(searchTerm.toLowerCase());

      const statusMatch = statusFilter === "todos" || getClientStatus(client) === statusFilter;
      const recorrenciaMatch = recorrenciaFilter === "todas" || client.recorrencia === recorrenciaFilter;

      return searchMatch && statusMatch && recorrenciaMatch;
    }
  );

  const handleSubmit = async (data: ClientFormData) => {
    try {
      if (editingClient) {
        await updateClient(editingClient.id, data);
        toast({ title: "Cliente atualizado", description: data.razaoSocial });
        setEditingClient(null);
      } else {
        await addClient(data);
        toast({ title: "Cliente cadastrado", description: data.razaoSocial });
      }
      setIsFormOpen(false);
    } catch (err: unknown) {
      toast({
        title: "Erro ao salvar cliente",
        description: err instanceof Error ? err.message : "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingClient(null);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("todos");
    setRecorrenciaFilter("todas");
  };

  return (
    <MainLayout totalCaixa={totalFaturamento}>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Gestao de Clientes</h1>
              <p className="text-sm text-muted-foreground">
                Visualize e gerencie todos os seus clientes em um so lugar
              </p>
            </div>
          </div>

          <Button onClick={() => setIsFormOpen(true)} className="gap-2 self-start sm:self-auto">
            <Plus className="w-4 h-4" />
            Adicionar Cliente
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4 card-glow-hover">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Total de Clientes</span>
              <Users className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">{loading ? "--" : totalClients}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 card-glow-hover">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Clientes Ativos</span>
              <UserCheck2 className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">{loading ? "--" : activeClients}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 card-glow-hover">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Clientes Inativos</span>
              <UserX2 className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">{loading ? "--" : inactiveClients}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 card-glow-hover">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Prospectos</span>
              <UserPlus2 className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">{loading ? "--" : prospectClients}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-border bg-card p-4 card-glow">
          <div className="grid gap-3 md:grid-cols-12">
            <div className="relative md:col-span-6">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente por nome, CNPJ, responsavel ou contato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="md:col-span-3">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ClientStatusFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos status</SelectItem>
                  <SelectItem value="ativos">Ativos</SelectItem>
                  <SelectItem value="inativos">Inativos</SelectItem>
                  <SelectItem value="prospectos">Prospectos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Select
                value={recorrenciaFilter}
                onValueChange={(value) => setRecorrenciaFilter(value as ClientRecorrenciaFilter)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Recorrencia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas recorrencias</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="semestral">Semestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1">
              <Filter className="h-3.5 w-3.5" />
              {filteredClients.length} resultado(s)
            </span>
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" onClick={resetFilters}>
              <Eraser className="h-3.5 w-3.5" />
              Limpar filtros
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card p-4 card-glow">
          <ClientTable
            clients={filteredClients}
            onEdit={handleEdit}
            onDelete={removeClient}
            onView={setViewingClient}
          />
        </div>

        {/* Form Modal */}
        <ClientForm
          open={isFormOpen}
          onClose={handleCloseForm}
          onSubmit={handleSubmit}
          defaultValues={
            editingClient
              ? {
                  razaoSocial: editingClient.razaoSocial,
                  cnpj: editingClient.cnpj,
                  endereco: editingClient.endereco,
                  valorPago: editingClient.valorPago,
                  recorrencia: editingClient.recorrencia,
                  responsavel: editingClient.responsavel,
                  contatoInterno: editingClient.contatoInterno,
                }
              : undefined
          }
          isEdit={!!editingClient}
        />

        {/* Details Modal */}
        <ClientDetails
          client={viewingClient}
          open={!!viewingClient}
          onClose={() => setViewingClient(null)}
        />
      </div>
    </MainLayout>
  );
}
