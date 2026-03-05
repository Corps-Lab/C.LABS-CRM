import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TopClientsChart } from "@/components/dashboard/TopClientsChart";
import { RevenueGoalCard } from "@/components/dashboard/RevenueGoalCard";
import { useClients } from "@/contexts/ClientContext";
import { useDemands } from "@/contexts/DemandContext";
import { useContracts } from "@/contexts/ContractContext";
import { useTransactions } from "@/contexts/TransactionContext";
import { DollarSign, CreditCard, TrendingUp, Clock, Users, KanbanSquare, FileText, Wallet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { clients, totalFaturamento } = useClients();
  const { demands } = useDemands();
  const { contracts } = useContracts();
  const { totalEntradas, totalDespesas } = useTransactions();
  const { user } = useAuth();
  const storageKey = useMemo(() => `crm_revenue_goal_${user?.id ?? "anon"}`, [user?.id]);
  const [goal, setGoal] = useState(15000);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = Number(saved);
        if (!Number.isNaN(parsed) && parsed > 0) setGoal(parsed);
      }
    } catch {
      /* ignore storage errors */
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, goal.toString());
    } catch {
      /* ignore storage errors */
    }
  }, [goal, storageKey]);

  // Calculate metrics from clients data
  const metricsData = {
    faturamento: totalFaturamento,
    despesas: totalDespesas,
    receitaAnual: totalFaturamento * 12,
    pendentes: demands.filter((d) => d.status === "pendente" || d.status === "atrasada").length,
    clientesAtivos: clients.length,
    demandasEmAndamento: demands.filter((d) => d.status === "em_andamento").length,
    contratosAtivos: contracts.length,
    saldoFinanceiro: totalEntradas - totalDespesas,
  };

  // Get top clients sorted by value
  const topClientsData = [...clients]
    .sort((a, b) => b.valorPago - a.valorPago)
    .slice(0, 10)
    .map((client) => ({
      name: client.razaoSocial.length > 15 
        ? client.razaoSocial.substring(0, 15) + "..." 
        : client.razaoSocial,
      value: client.valorPago,
    }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <MainLayout totalCaixa={metricsData.faturamento}>
      <div className="space-y-6 animate-fade-in">
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            title="Faturamento"
            value={formatCurrency(metricsData.faturamento)}
            icon={<DollarSign className="w-6 h-6" />}
            variant="primary"
          />
          <MetricCard
            title="Despesas"
            value={formatCurrency(metricsData.despesas)}
            icon={<CreditCard className="w-6 h-6" />}
          />
          <MetricCard
            title="Receita Anual Projetada"
            value={formatCurrency(metricsData.receitaAnual)}
            icon={<TrendingUp className="w-6 h-6" />}
          />
          <MetricCard
            title="Pendentes"
            value={metricsData.pendentes.toString()}
            icon={<Clock className="w-6 h-6" />}
          />
        </div>

        {/* Extra Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            title="Clientes Ativos"
            value={metricsData.clientesAtivos.toString()}
            icon={<Users className="w-6 h-6" />}
            variant="primary"
          />
          <MetricCard
            title="Demandas em Andamento"
            value={metricsData.demandasEmAndamento.toString()}
            icon={<KanbanSquare className="w-6 h-6" />}
          />
          <MetricCard
            title="Contratos Cadastrados"
            value={metricsData.contratosAtivos.toString()}
            icon={<FileText className="w-6 h-6" />}
          />
          <MetricCard
            title="Saldo Financeiro"
            value={formatCurrency(metricsData.saldoFinanceiro)}
            icon={<Wallet className="w-6 h-6" />}
            variant="primary"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TopClientsChart data={topClientsData} />
          </div>
          <div>
          <RevenueGoalCard current={metricsData.faturamento} goal={goal} onEditGoal={(v) => setGoal(v)} />
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;
