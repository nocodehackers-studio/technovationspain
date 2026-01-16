import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  trend?: {
    value: number;
    direction: "up" | "down";
    period: string;
  };
  color?: "primary" | "success" | "warning" | "destructive" | "info" | "accent";
  onClick?: () => void;
}

const colorClasses = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  accent: "bg-accent/10 text-accent",
};

const trendColors = {
  up: "text-success",
  down: "text-destructive",
};

export function MetricCard({
  title,
  value,
  icon,
  trend,
  color = "primary",
  onClick,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        "transition-all duration-200",
        onClick && "cursor-pointer hover:shadow-md hover:-translate-y-0.5"
      )}
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-4 p-6">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg",
            colorClasses[color]
          )}
        >
          {icon}
        </div>
        
        <div className="flex flex-col gap-1">
          <span className="text-2xl font-bold tracking-tight">{value}</span>
          <span className="text-sm text-muted-foreground">{title}</span>
          
          {trend && (
            <div className={cn("flex items-center gap-1 text-xs", trendColors[trend.direction])}>
              {trend.direction === "up" ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{trend.value}% {trend.period}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
