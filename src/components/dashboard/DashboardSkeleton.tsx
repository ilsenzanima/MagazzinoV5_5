import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <Skeleton className="h-3 w-[100px] mb-2" /> {/* Label */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-full" /> {/* Icon */}
              <Skeleton className="h-8 w-[120px]" /> {/* Value */}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
