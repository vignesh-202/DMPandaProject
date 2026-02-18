import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface ModernCalendarProps {
    startDate: string;
    endDate: string;
    onSelect: (start: string, end: string) => void;
    onClose: () => void;
}

const ModernCalendar: React.FC<ModernCalendarProps> = ({ startDate, endDate, onSelect, onClose }) => {
    // Minimum date: October 6, 2010
    const minDate = useMemo(() => new Date(2010, 9, 6), []);
    // Maximum date: Today (end of day)
    const maxDate = useMemo(() => {
        const d = new Date();
        d.setHours(23, 59, 59, 999);
        return d;
    }, []);

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [tempStart, setTempStart] = useState<Date | null>(startDate ? new Date(startDate) : null);
    const [tempEnd, setTempEnd] = useState<Date | null>(endDate ? new Date(endDate) : null);
    const [view, setView] = useState<'days' | 'months' | 'years'>('days');
    const [viewYear, setViewYear] = useState(currentMonth.getFullYear());

    const isSelectingStart = !tempStart || (tempStart && tempEnd);

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const generateYears = (around: number) => {
        const years = [];
        const currentYearValue = new Date().getFullYear();
        const start = around - 12;
        for (let i = start; i < start + 24; i++) {
            if (i >= 2010 && i <= currentYearValue) {
                years.push(i);
            }
        }
        return years;
    };

    const getDaysInMonth = (year: number, month: number) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year: number, month: number) => {
        return new Date(year, month, 1).getDay();
    };

    const isDateDisabled = (date: Date) => {
        date.setHours(0, 0, 0, 0);
        const compareMin = new Date(minDate);
        compareMin.setHours(0, 0, 0, 0);
        const compareMax = new Date(maxDate);
        compareMax.setHours(0, 0, 0, 0);
        return date < compareMin || date > compareMax;
    };

    const handleDateClick = (day: number) => {
        const selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        selectedDate.setHours(0, 0, 0, 0);

        if (isDateDisabled(selectedDate)) return;

        if (isSelectingStart) {
            setTempStart(selectedDate);
            setTempEnd(null);
        } else {
            if (selectedDate < tempStart!) {
                setTempStart(selectedDate);
                setTempEnd(null);
            } else if (selectedDate.getTime() === tempStart!.getTime()) {
                setTempStart(null);
                setTempEnd(null);
            } else {
                setTempEnd(selectedDate);
            }
        }
    };

    const formatDate = (date: Date) => {
        return date.toISOString().split('T')[0];
    };

    const isToday = (day: number) => {
        const today = new Date();
        return today.getDate() === day &&
            today.getMonth() === currentMonth.getMonth() &&
            today.getFullYear() === currentMonth.getFullYear();
    };

    const isSelected = (day: number) => {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        date.setHours(0, 0, 0, 0);
        if (tempStart && date.getTime() === tempStart.getTime()) return true;
        if (tempEnd && date.getTime() === tempEnd.getTime()) return true;
        return false;
    };

    const isInRange = (day: number) => {
        if (!tempStart || !tempEnd) return false;
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        date.setHours(0, 0, 0, 0);
        return date > tempStart && date < tempEnd;
    };

    const renderDays = () => {
        const days = [];
        const totalDays = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
        const firstDay = getFirstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth());

        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="p-2" />);
        }

        for (let d = 1; d <= totalDays; d++) {
            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
            const disabled = isDateDisabled(date);
            const isSel = isSelected(d);
            const inRange = isInRange(d);
            const today = isToday(d);

            days.push(
                <button
                    key={d}
                    disabled={disabled}
                    onClick={() => handleDateClick(d)}
                    className={`p-2 w-full h-10 rounded-xl text-xs font-bold transition-all flex items-center justify-center relative
              ${isSel ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' :
                            inRange ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' :
                                'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}
              ${today && !isSel ? 'border border-blue-200 dark:border-blue-800' : ''}
              ${disabled ? 'opacity-20 cursor-not-allowed grayscale' : ''}
            `}
                >
                    {d}
                    {today && !isSel && <div className="absolute bottom-1.5 w-1 h-1 bg-blue-500 rounded-full" />}
                </button>
            );
        }
        return (
            <div className="grid grid-cols-7 gap-1 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                    <div key={d} className="text-center text-[9px] font-black text-gray-400 uppercase tracking-widest py-2">
                        {d}
                    </div>
                ))}
                {days}
            </div>
        );
    };

    const renderMonths = () => (
        <div className="grid grid-cols-3 gap-2 mb-2 animate-in fade-in zoom-in-95 duration-200">
            {months.map((m, idx) => {
                const dayInMonth = new Date(currentMonth.getFullYear(), idx, 1);
                const lastDayOfMonth = new Date(currentMonth.getFullYear(), idx + 1, 0);
                const isDisabled = lastDayOfMonth < minDate || dayInMonth > maxDate;

                return (
                    <button
                        key={m}
                        disabled={isDisabled}
                        onClick={() => {
                            setCurrentMonth(new Date(currentMonth.getFullYear(), idx));
                            setView('days');
                        }}
                        className={`p-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all
                ${currentMonth.getMonth() === idx ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400'}
                ${isDisabled ? 'opacity-20 cursor-not-allowed grayscale' : ''}
              `}
                    >
                        {m.substring(0, 3)}
                    </button>
                );
            })}
        </div>
    );

    const handleYearSelect = (y: number) => {
        let targetMonth = currentMonth.getMonth();

        if (isSelectingStart) {
            // Selecting "From" date: jump to minimum allowed date of that year
            if (y === 2010) {
                targetMonth = 9; // October 2010
            } else {
                targetMonth = 0; // January
            }
        } else {
            // Selecting "To" date: if current year, jump to current month
            const today = new Date();
            if (y === today.getFullYear()) {
                targetMonth = today.getMonth();
            } else {
                // If picking a past year for "To" date, navigate to December of that year
                targetMonth = 11;
            }
        }

        setCurrentMonth(new Date(y, targetMonth));
        setViewYear(y);
        setView('days');
    };

    const renderYears = () => (
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="grid grid-cols-3 gap-2">
                {generateYears(viewYear).map(y => {
                    const currentYearValue = new Date().getFullYear();
                    const isDisabled = y < 2010 || y > currentYearValue;
                    return (
                        <button
                            key={y}
                            disabled={isDisabled}
                            onClick={() => handleYearSelect(y)}
                            className={`p-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all
                ${currentMonth.getFullYear() === y ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400'}
                ${isDisabled ? 'opacity-5 opacity-20 cursor-not-allowed grayscale' : ''}
              `}
                        >
                            {y}
                        </button>
                    );
                })}
            </div>
            <div className="flex justify-center gap-4">
                <button
                    disabled={viewYear - 12 < 2010}
                    onClick={() => setViewYear(v => v - 24)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors disabled:opacity-20"
                >
                    <ChevronLeft className="w-4 h-4 text-gray-400" />
                </button>
                <button
                    disabled={viewYear + 12 > maxDate.getFullYear()}
                    onClick={() => setViewYear(v => v + 24)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors disabled:opacity-20"
                >
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
            </div>
        </div>
    );

    return (
        <div className="p-6 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 min-w-[320px]">
            <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1 pl-1">
                        {isSelectingStart ? 'Select Start Date' : 'Select End Date'}
                    </p>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setView(view === 'months' ? 'days' : 'months')}
                            className={`px-3 py-1.5 rounded-xl transition-all group ${view === 'months' ? 'bg-blue-600' : 'hover:bg-blue-50 dark:hover:bg-blue-900/10'}`}
                        >
                            <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${view === 'months' ? 'text-white' : 'text-gray-900 dark:text-white group-hover:text-blue-600'}`}>
                                {months[currentMonth.getMonth()]}
                            </span>
                        </button>
                        <button
                            onClick={() => setView(view === 'years' ? 'days' : 'years')}
                            className={`px-3 py-1.5 rounded-xl transition-all group ${view === 'years' ? 'bg-blue-600' : 'hover:bg-blue-50 dark:hover:bg-blue-900/10'}`}
                        >
                            <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${view === 'years' ? 'text-white' : 'text-gray-900 dark:text-white group-hover:text-blue-600'}`}>
                                {currentMonth.getFullYear()}
                            </span>
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {view === 'days' && (
                        <>
                            <button
                                disabled={currentMonth.getFullYear() === 2010 && currentMonth.getMonth() === 9}
                                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-20"
                            >
                                <ChevronLeft className="w-4 h-4 text-gray-500" />
                            </button>
                            <button
                                onClick={() => setCurrentMonth(new Date())}
                                className="px-2 py-1 text-[9px] font-black uppercase text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-all"
                            >
                                Today
                            </button>
                            <button
                                disabled={currentMonth.getFullYear() === maxDate.getFullYear() && currentMonth.getMonth() === maxDate.getMonth()}
                                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-20"
                            >
                                <ChevronRight className="w-4 h-4 text-gray-500" />
                            </button>
                        </>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-gray-400 hover:text-red-500 ml-2"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="min-h-[220px] flex items-center justify-center">
                <div className="w-full">
                    {view === 'days' && renderDays()}
                    {view === 'months' && renderMonths()}
                    {view === 'years' && renderYears()}
                </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                <div className="flex-1 space-y-1">
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest pl-1">Range</p>
                    <div className="flex items-center gap-2 h-8">
                        <div className={`flex-1 bg-gray-50 dark:bg-black/40 rounded-lg border flex items-center px-3 transition-colors ${isSelectingStart ? 'border-blue-500/50 shadow-sm shadow-blue-500/10' : 'border-slate-100 dark:border-slate-800'}`}>
                            <span className={`text-[10px] font-bold ${tempStart ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                                {tempStart ? formatDate(tempStart) : 'Start'}
                            </span>
                        </div>
                        <div className="w-2 h-0.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
                        <div className={`flex-1 bg-gray-50 dark:bg-black/40 rounded-lg border flex items-center px-3 transition-colors ${!isSelectingStart ? 'border-blue-500/50 shadow-sm shadow-blue-500/10' : 'border-slate-100 dark:border-slate-800'}`}>
                            <span className={`text-[10px] font-bold ${tempEnd ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                                {tempEnd ? formatDate(tempEnd) : 'End'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-end gap-2 h-8">
                    <button
                        onClick={() => onSelect(tempStart ? formatDate(tempStart) : '', tempEnd ? formatDate(tempEnd) : '')}
                        disabled={!tempStart || !tempEnd}
                        className="h-full px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
                    >
                        Apply Range
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModernCalendar;
