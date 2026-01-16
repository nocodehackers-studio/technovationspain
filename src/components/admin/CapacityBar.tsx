import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface CapacityBarProps {
  current: number;
  max: number;
  showPercentage?: boolean;
  showNumbers?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-1.5",
  md: "h-2",
  lg: "h-3",
};

export function CapacityBar({
  current,
  max,
  showPercentage = true,
  showNumbers = true,
  size = "md",
}: CapacityBarProps) {
  const percentage = max > 0 ? Math.round((current / max) * 100) : 0;

  const getColorClass = () => {
    if (percentage >= 100) return "bg-muted-foreground";
    if (percentage >= 90) return "bg-destructive";
    if (percentage >= 70) return "bg-warning";
    return "bg-success";
  };

  const getStatus = () => {
    if (percentage >= 100) return "Completo";
    if (percentage >= 90) return "Casi lleno";
    if (percentage >= 70) return "Llenándose";
    return "Disponible";
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <Progress
          value={Math.min(percentage, 100)}
          className={cn("w-full", sizeClasses[size])}
        />
        <div
          className={cn(
            "absolute inset-0 rounded-full transition-all",
            sizeClasses[size],
            getColorClass()
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {showNumbers && (
          <span>
            {current} / {max}
          </span>
        )}
        {showPercentage && (
          <span className={cn(
            percentage >= 90 && "text-destructive",
            percentage >= 70 && percentage < 90 && "text-warning",
            percentage < 70 && "text-success"
          )}>
            {percentage}% - {getStatus()}
          </span>
        )}
      </div>
    </div>
  );
}
