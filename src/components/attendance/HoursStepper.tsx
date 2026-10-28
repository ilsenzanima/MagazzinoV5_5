import { Button } from "@/components/ui/button";

interface HoursStepperProps {
    hours: number;
    onChange: (delta: number) => void;
}

// −1 h, −½ h, valore, +½ h, +1 h
const STEPS = [-1, -0.5, 0.5, 1];
const label = (d: number) => `${d > 0 ? '+' : '−'}${Math.abs(d) === 0.5 ? '½' : '1'}`;

export function HoursStepper({ hours, onChange }: HoursStepperProps) {
    const btn = (d: number) => (
        <Button
            key={d}
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-9 px-0 text-xs font-semibold"
            disabled={d < 0 && hours + d < 0.5}
            title={`${d > 0 ? 'Aggiungi' : 'Togli'} ${Math.abs(d) === 0.5 ? 'mezz\'ora' : 'un\'ora'}`}
            onClick={() => onChange(d)}
        >
            {label(d)}
        </Button>
    );
    return (
        <div className="flex items-center gap-1">
            {STEPS.filter(d => d < 0).map(btn)}
            <span className="w-14 text-center text-sm font-semibold tabular-nums">{String(hours).replace('.', ',')} h</span>
            {STEPS.filter(d => d > 0).map(btn)}
        </div>
    );
}
