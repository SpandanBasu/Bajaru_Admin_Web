import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bg: string;
  animationIndex?: number;
}

export function StatCard({ title, value, icon: Icon, color, bg, animationIndex = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationIndex * 0.1, duration: 0.4 }}
    >
      <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300 rounded-2xl overflow-hidden group">
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className="text-3xl font-bold font-display text-foreground">{value}</p>
            </div>
            <div className={`p-3 rounded-xl ${bg} ${color} group-hover:scale-110 transition-transform duration-300`}>
              <Icon className="w-6 h-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
