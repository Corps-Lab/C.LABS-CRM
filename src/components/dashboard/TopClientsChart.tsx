import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ClientData {
  name: string;
  value: number;
}

interface TopClientsChartProps {
  data: ClientData[];
}

export function TopClientsChart({ data }: TopClientsChartProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(1)}k`;
    }
    return `R$ ${value}`;
  };

  return (
    <div className="p-6 rounded-xl bg-card border border-border card-glow">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-primary">Top 10 Clientes</h3>
        <p className="text-sm text-muted-foreground">Receita por Cliente</p>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="hsl(0 0% 18%)" 
              vertical={false} 
            />
            <XAxis
              dataKey="name"
              tick={{ fill: "hsl(0 0% 65%)", fontSize: 12 }}
              axisLine={{ stroke: "hsl(0 0% 18%)" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fill: "hsl(0 0% 65%)", fontSize: 12 }}
              axisLine={{ stroke: "hsl(0 0% 18%)" }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(0 0% 7%)",
                border: "1px solid hsl(0 0% 18%)",
                borderRadius: "8px",
                color: "hsl(0 0% 98%)",
              }}
              formatter={(value: number) => [
                new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(value),
                "Receita",
              ]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#colorValue)"
              dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
