"use client";

interface AttendanceStripProps {
    startDate: string;
    endDate: string;
    /** Date (YYYY-MM-DD) in cui era presente almeno un lavoratore */
    presenceDates: Set<string>;
    label?: string;
}

const DAY_WIDTH = 10;

function eachDate(start: string, end: string): string[] {
    const dates: string[] = [];
    const cur = new Date(start + "T00:00:00");
    const last = new Date(end + "T00:00:00");
    while (cur <= last) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
    }
    return dates;
}

export function AttendanceStrip({ startDate, endDate, presenceDates, label }: AttendanceStripProps) {
    if (!startDate || !endDate || startDate > endDate) return null;
    const days = eachDate(startDate, endDate);

    return (
        <div className="w-full overflow-x-auto">
            {label && <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">{label}</p>}
            <div className="relative" style={{ width: days.length * DAY_WIDTH, height: 18 }}>
                {/* Linea di base */}
                <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-200 dark:bg-slate-700" />
                {days.map((date, i) => {
                    const present = presenceDates.has(date);
                    return (
                        <div
                            key={date}
                            title={`${date}${present ? " · presenza registrata" : ""}`}
                            className={present ? "absolute rounded-full bg-emerald-500" : "absolute rounded-full bg-slate-300 dark:bg-slate-600"}
                            style={{
                                left: i * DAY_WIDTH + DAY_WIDTH / 2 - (present ? 3 : 1.5),
                                top: present ? 6 : 8,
                                width: present ? 6 : 3,
                                height: present ? 6 : 3,
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
}
