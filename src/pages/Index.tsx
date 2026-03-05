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
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const Index = () => {
  const { clients } = useClients();
  const { demands } = useDemands();
  const { contracts } = useContracts();
  const { transactions } = useTransactions();
  const { user } = useAuth();
  const storageKey = useMemo(() => `crm_revenue_goal_${user?.id ?? "anon"}`, [user?.id]);
  const [goal, setGoal] = useState(15000);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

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

  const monthlyRecurringRevenue = useMemo(() => {
    return clients.reduce((acc, client) => {
      const value = Number(client.valorPago || 0);
      if (value <= 0) return acc;

      const monthlyFactor = {
        mensal: 1,
        trimestral: 1 / 3,
        semestral: 1 / 6,
        anual: 1 / 12,
      };

      return acc + value * monthlyFactor[client.recorrencia];
    }, 0);
  }, [clients]);

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

  const monthlyFinance = useMemo(() => {
    const data = MONTH_LABELS.map((name, index) => ({
      name,
      month: index + 1,
      entradas: 0,
      despesas: 0,
    }));

    transactions
      .filter((t) => t.ano === currentYear)
      .forEach((t) => {
        const idx = Math.max(0, Math.min(11, t.mes - 1));
        if (t.tipo === "entrada") data[idx].entradas += t.valor;
        else data[idx].despesas += t.valor;
      });

    return data;
  }, [transactions, currentYear]);

  const yearlyTotals = useMemo(() => {
    return monthlyFinance.reduce(
      (acc, month) => ({
        entradas: acc.entradas + month.entradas,
        despesas: acc.despesas + month.despesas,
      }),
      { entradas: 0, despesas: 0 }
    );
  }, [monthlyFinance]);

  // Calculate metrics from real dashboard sources
  const metricsData = {
    faturamento: yearlyTotals.entradas,
    despesas: yearlyTotals.despesas,
    receitaAnual: monthlyRecurringRevenue * 12,
    pendentes: demands.filter((d) => d.status === "pendente" || d.status === "atrasada").length,
    clientesAtivos: clients.filter((c) => Number(c.valorPago || 0) > 0).length,
    demandasEmAndamento: demands.filter((d) => d.status === "em_andamento").length,
    contratosAtivos: contracts.length,
    saldoFinanceiro: yearlyTotals.entradas - yearlyTotals.despesas,
  };

  const mrrProjectionData = useMemo(() => {
    return monthlyFinance.map((m, index) => {
      const isFutureMonth = index + 1 > currentMonth;
      const mrr = isFutureMonth ? monthlyRecurringRevenue : m.entradas > 0 ? m.entradas : monthlyRecurringRevenue;
      return {
        ...m,
        mrr: Math.round(mrr),
        source: isFutureMonth ? "projecao" : "real",
      };
    });
  }, [monthlyFinance, monthlyRecurringRevenue, currentMonth]);

  const miniFinanceData = useMemo(() => {
    const start = Math.max(0, currentMonth - 6);
    const recent = monthlyFinance.slice(start, currentMonth);
    return recent.length > 0 ? recent : monthlyFinance.slice(0, 6);
  }, [monthlyFinance, currentMonth]);

  const currentMonthFinance = useMemo(() => {
    const selected = monthlyFinance[currentMonth - 1];
    if (!selected) {
      return { entradas: 0, despesas: 0, lucro: 0, margem: 0 };
    }
    const lucro = selected.entradas - selected.despesas;
    const margem = selected.entradas > 0 ? (lucro / selected.entradas) * 100 : 0;
    return {
      entradas: selected.entradas,
      despesas: selected.despesas,
      lucro,
      margem,
    };
  }, [monthlyFinance, currentMonth]);

  const profitPercent = Math.max(0, Math.min(100, Math.abs(currentMonthFinance.margem)));
  const isPositiveProfit = currentMonthFinance.lucro >= 0;
  const marginLabel = `${currentMonthFinance.margem >= 0 ? "+" : ""}${currentMonthFinance.margem.toFixed(1)}%`;
  const profitGaugeData = [
    { name: "percentual", value: profitPercent },
    { name: "restante", value: 100 - profitPercent },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <MainLayout totalCaixa={metricsData.saldoFinanceiro}>
      <div className="space-y-6 animate-fade-in">
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            title="Entradas no Ano"
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

        {/* Projection Section */}
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/25 bg-card p-4 sm:p-5">
            <div className="mb-3">
              <h3 className="text-base sm:text-lg font-semibold text-primary">MRR (Receita Recorrente Mensal) - Projecao</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Valor para {currentYear} com base em entradas reais e recorrencia ativa dos clientes.
              </p>
            </div>
            <div className="h-[220px] sm:h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mrrProjectionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mrrBars" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "10px",
                    }}
                    formatter={(value: number) => [formatCurrency(value), "MRR"]}
                  />
                  <Bar dataKey="mrr" fill="url(#mrrBars)" radius={[6, 6, 2, 2]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-semibold text-primary">Financeiro</h3>
                <span className="text-[11px] px-2 py-1 rounded-md border border-border bg-muted/30 text-muted-foreground">
                  Dados Consolidados
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">Faturamento x Despesas (ultimos 6 meses)</p>
              <div className="h-[170px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={miniFinanceData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="miniEntradas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="miniDespesas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "10px",
                      }}
                      formatter={(value: number, key: string) => [formatCurrency(value), key === "entradas" ? "Receita" : "Despesa"]}
                    />
                    <Area type="monotone" dataKey="despesas" stroke="#ef4444" fill="url(#miniDespesas)" strokeWidth={2} />
                    <Area type="monotone" dataKey="entradas" stroke="hsl(var(--primary))" fill="url(#miniEntradas)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm sm:text-base font-semibold text-primary">Lucro Mensal</h3>
              <div className="relative mt-3 h-[140px]">
                <div className="absolute inset-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={profitGaugeData}
                        dataKey="value"
                        innerRadius={38}
                        outerRadius={54}
                        startAngle={90}
                        endAngle={-270}
                        stroke="none"
                      >
                        <Cell fill={isPositiveProfit ? "hsl(var(--primary))" : "#ef4444"} />
                        <Cell fill="hsl(var(--muted))" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">margem</p>
                  <p className={`text-lg font-bold ${isPositiveProfit ? "text-primary" : "text-red-500"}`}>{marginLabel}</p>
                </div>
              </div>
              <div className="space-y-1.5 text-xs">
                <p className="text-emerald-400">Faturamento: {formatCurrency(currentMonthFinance.entradas)}</p>
                <p className="text-red-400">Despesas: {formatCurrency(currentMonthFinance.despesas)}</p>
                <p className={isPositiveProfit ? "text-primary" : "text-red-400"}>
                  Lucro: {formatCurrency(currentMonthFinance.lucro)}
                </p>
              </div>
            </div>
          </div>
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
