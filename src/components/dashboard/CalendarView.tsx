"use client"

import { useState, memo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { attendanceApi, Attendance } from "@/lib/api";

const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MONTHS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];

const STATUS_COLORS = {
  presence: "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300",
  sick: "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300",
  holiday: "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300",
  permit: "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300",
  course: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300",
};

const STATUS_LABELS = {
  presence: "Presente",
  sick: "Malattia",
  holiday: "Ferie",
  permit: "Permesso",
  course: "Corso",
};

export const CalendarView = memo(function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    // 0 = Sunday, 1 = Monday, etc.
    // We want Monday as 0
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const loadAttendanceData = async () => {
    try {
      setLoading(true);
      const data = await attendanceApi.getByMonth(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1
      );
      setAttendanceData(data);
    } catch (error) {
      console.error("Error loading attendance data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendanceData();
  }, [currentDate]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const getEventsForDay = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return attendanceData.filter(att => att.date === dateStr);
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const today = new Date();

  const days = [];
  // Padding for previous month
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="h-24 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700" />);
  }

  // Days of current month
  for (let i = 1; i <= daysInMonth; i++) {
    const isToday =
      i === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear();

    const events = getEventsForDay(i);

    days.push(
      <div
        key={i}
        className={cn(
          "h-24 p-2 border border-slate-100 dark:border-slate-700 relative group hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors overflow-hidden",
          isToday && "bg-blue-50/50 dark:bg-blue-900/30"
        )}
      >
        <span className={cn(
          "text-sm font-medium h-6 w-6 flex items-center justify-center rounded-full",
          isToday ? "bg-blue-600 text-white" : "text-slate-700 dark:text-slate-300"
        )}>
          {i}
        </span>

        {/* Real Events/Attendance */}
        {events.length > 0 && (
          <div className="mt-2 space-y-1 overflow-y-auto max-h-14">
            {events.slice(0, 2).map((event, idx) => (
              <div
                key={idx}
                className={cn(
                  "text-[10px] px-1 py-0.5 rounded truncate",
                  STATUS_COLORS[event.status as keyof typeof STATUS_COLORS] || "bg-gray-100 text-gray-700"
                )}
                title={`${event.workerName}: ${STATUS_LABELS[event.status as keyof typeof STATUS_LABELS] || event.status} - ${event.hours}h`}
              >
                {event.workerName?.split(' ')[0]}: {STATUS_LABELS[event.status as keyof typeof STATUS_LABELS] || event.status}
              </div>
            ))}
            {events.length > 2 && (
              <div className="text-[9px] text-slate-500 dark:text-slate-400 px-1">
                +{events.length - 2} altri
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-bold">
          {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevMonth} disabled={loading}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleNextMonth} disabled={loading}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 mb-2">
              {DAYS.map((day) => (
                <div key={day} className="text-center text-sm font-medium text-slate-500 dark:text-slate-400 py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 bg-white dark:bg-card rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
              {days}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
});

