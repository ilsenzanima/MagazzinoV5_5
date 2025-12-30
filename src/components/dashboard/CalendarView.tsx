"use client"

import { useState, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MONTHS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];

export const CalendarView = memo(function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    // 0 = Sunday, 1 = Monday, etc.
    // We want Monday as 0
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const today = new Date();

  const days = [];
  // Padding for previous month
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="h-24 bg-slate-50/50 border border-slate-100" />);
  }

  // Days of current month
  for (let i = 1; i <= daysInMonth; i++) {
    const isToday =
      i === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear();

    days.push(
      <div
        key={i}
        className={cn(
          "h-24 p-2 border border-slate-100 relative group hover:bg-slate-50 transition-colors",
          isToday && "bg-blue-50/50"
        )}
      >
        <span className={cn(
          "text-sm font-medium h-6 w-6 flex items-center justify-center rounded-full",
          isToday ? "bg-blue-600 text-white" : "text-slate-700"
        )}>
          {i}
        </span>

        {/* Mock Events/Attendance Dots */}
        {i % 5 === 0 && (
          <div className="mt-2 space-y-1">
            <div className="text-[10px] bg-green-100 text-green-700 px-1 py-0.5 rounded truncate">
              Mario: Presente
            </div>
          </div>
        )}
        {i % 12 === 0 && (
          <div className="mt-2 space-y-1">
            <div className="text-[10px] bg-red-100 text-red-700 px-1 py-0.5 rounded truncate">
              Luigi: Malattia
            </div>
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
          <Button variant="outline" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 mb-2">
          {DAYS.map((day) => (
            <div key={day} className="text-center text-sm font-medium text-slate-500 py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 bg-white rounded-lg overflow-hidden border border-slate-200">
          {days}
        </div>
      </CardContent>
    </Card>
  );
});
