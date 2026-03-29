import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RevenueChartProps {
  data: Array<{ name: string; revenue: number }>;
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <Card className="col-span-1 lg:col-span-2 border-border/50 shadow-sm rounded-2xl">
      <CardHeader className="border-b border-border/30 pb-4">
        <CardTitle className="text-lg font-bold">Revenue Overview</CardTitle>
      </CardHeader>
      <CardContent className="p-6 h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} dx={-10} tickFormatter={(val) => `₹${val}`} />
            <Tooltip
              contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}
              itemStyle={{ color: "hsl(var(--foreground))", fontWeight: "bold" }}
              formatter={(value: number) => [`₹${value}`, "Revenue"]}
            />
            <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
