import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface ModernCalendarProps {
    startDate: string;
    endDate: string;
    onSelect: (start: string, end: string) => void;
    onClose: () => void;
    minDate?: string;
    maxDate?: string;
    compact?: boolean;
    selectionTarget?: 'from' | 'to';
    showCloseButton?: boolean;
}

const ModernCalendar: React.FC<ModernCalendarProps> = ({
    startDate,
    endDate,
    onSelect,
    onClose,
    minDate,
    maxDate,
    compact = false,
    selectionTarget = 'from',
    showCloseButton = true
}) => {
    const minDateValue = useMemo(() => {
        const parsed = minDate ? new Date(minDate) : new Date(2010, 9, 6);
        parsed.setHours(0, 0, 0, 0);
        return parsed;
    }, [minDate]);

    const maxDateValue = useMemo(() => {
        const parsed = maxDate ? new Date(maxDate) : new Date();
        const d = new Date(parsed);
        d.setHours(23, 59, 59, 999);
        return d;
    }, [maxDate]);

    const initialMonth = useMemo(() => {
        const anchor = startDate || endDate || maxDate || '';
        const parsed = anchor ? new Date(anchor) : new Date();
        return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    }, [endDate, maxDate, startDate]);

    const [currentMonth, setCurrentMonth] = useState(initialMonth);
    const [tempStart, setTempStart] = useState<Date | null>(startDate ? new Date(startDate) : null);
    const [tempEnd, setTempEnd] = useState<Date | null>(endDate ? new Date(endDate) : null);
    const [view, setView] = useState<'days' | 'months' | 'years'>('days');
    const [viewYear, setViewYear] = useState(initialMonth.getFullYear());
    const [selectionMode, setSelectionMode] = useState<'start' | 'end'>(selectionTarget === 'to' ? 'end' : 'start');

    const isSelectingStart = selectionMode === 'start';
    const dayButtonClass = compact ? 'h-8 rounded-lg text-[11px]' : 'h-10 rounded-xl text-xs';
    const monthButtonClass = compact ? 'p-2.5 rounded-xl text-[9px]' : 'p-3 rounded-2xl text-[10px]';
    const shellClass = compact
        ? 'min-w-[272px] max-w-[296px] rounded-[1.6rem] p-3.5 space-y-2.5'
        : 'min-w-[320px] rounded-[2.5rem] p-6 space-y-4';

    useEffect(() => {
        const nextStart = startDate ? new Date(startDate) : null;
        const nextEnd = endDate ? new Date(endDate) : null;
        setTempStart(nextStart && !Number.isNaN(nextStart.getTime()) ? nextStart : null);
        setTempEnd(nextEnd && !Number.isNaN(nextEnd.getTime()) ? nextEnd : null);
        setCurrentMonth(initialMonth);
        setViewYear(initialMonth.getFullYear());
        setView('days');
        setSelectionMode(selectionTarget === 'to' ? 'end' : 'start');
    }, [endDate, initialMonth, selectionTarget, startDate]);

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const generateYears = (around: number) => {
        const years = [];
        const minYear = minDateValue.getFullYear();
        const currentYearValue = maxDateValue.getFullYear();
        const start = around - 12;
        for (let i = start; i < start + 24; i++) {
            if (i >= minYear && i <= currentYearValue) {
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
        const compareMin = new Date(minDateValue);
        compareMin.setHours(0, 0, 0, 0);
        const compareMax = new Date(maxDateValue);
        compareMax.setHours(0, 0, 0, 0);
        return date < compareMin || date > compareMax;
    };

    const handleDateClick = (day: number) => {
        const selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        selectedDate.setHours(0, 0, 0, 0);

        if (isDateDisabled(selectedDate)) return;

        if (isSelectingStart) {
            setTempStart(selectedDate);
            setTempEnd((currentEnd) => {
                if (!currentEnd) return null;
                return selectedDate <= currentEnd ? currentEnd : null;
            });
            setSelectionMode('end');
        } else {
            if (!tempStart || selectedDate < tempStart) {
                setTempStart(selectedDate);
                setTempEnd(null);
                setSelectionMode('end');
            } else if (selectedDate.getTime() === tempStart.getTime()) {
                setTempEnd(selectedDate);
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
                    className={`w-full p-2 font-bold transition-all flex items-center justify-center relative ${dayButtonClass}
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
                    <div key={d} className={`text-center font-black text-gray-400 uppercase tracking-widest ${compact ? 'py-1.5 text-[8px]' : 'py-2 text-[9px]'}`}>
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
                const isDisabled = lastDayOfMonth < minDateValue || dayInMonth > maxDateValue;

                return (
                    <button
                        key={m}
                        disabled={isDisabled}
                        onClick={() => {
                            setCurrentMonth(new Date(currentMonth.getFullYear(), idx));
                            setView('days');
                        }}
                        className={`${monthButtonClass} font-black uppercase tracking-widest transition-all
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
            if (y === minDateValue.getFullYear()) {
                targetMonth = minDateValue.getMonth();
            } else {
                targetMonth = 0; // January
            }
        } else {
            // Selecting "To" date: if current year, jump to current month
            if (y === maxDateValue.getFullYear()) {
                targetMonth = maxDateValue.getMonth();
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
                    const currentYearValue = maxDateValue.getFullYear();
                    const isDisabled = y < minDateValue.getFullYear() || y > currentYearValue;
                    return (
                        <button
                            key={y}
                            disabled={isDisabled}
                            onClick={() => handleYearSelect(y)}
                            className={`${monthButtonClass} font-black uppercase tracking-widest transition-all
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
                    disabled={viewYear - 12 < minDateValue.getFullYear()}
                    onClick={() => setViewYear(v => v - 24)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors disabled:opacity-20"
                >
                    <ChevronLeft className="w-4 h-4 text-gray-400" />
                </button>
                <button
                    disabled={viewYear + 12 > maxDateValue.getFullYear()}
                    onClick={() => setViewYear(v => v + 24)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors disabled:opacity-20"
                >
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
            </div>
        </div>
    );

    return (
        <div className={`${shellClass} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200`}>
            <div className="relative mb-2 flex items-start justify-between">
                <div className="flex-1">
                    <p className={`${compact ? 'mb-0.5 text-[8px]' : 'mb-1 text-[9px]'} font-black text-blue-500 uppercase tracking-widest pl-1`}>
                        {isSelectingStart ? 'Select Start Date' : 'Select End Date'}
                    </p>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setView(view === 'months' ? 'days' : 'months')}
                            className={`${compact ? 'px-2.5 py-1.5' : 'px-3 py-1.5'} rounded-xl transition-all group ${view === 'months' ? 'bg-blue-600' : 'hover:bg-blue-50 dark:hover:bg-blue-900/10'}`}
                        >
                            <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${view === 'months' ? 'text-white' : 'text-gray-900 dark:text-white group-hover:text-blue-600'}`}>
                                {months[currentMonth.getMonth()]}
                            </span>
                        </button>
                        <button
                            onClick={() => setView(view === 'years' ? 'days' : 'years')}
                            className={`${compact ? 'px-2.5 py-1.5' : 'px-3 py-1.5'} rounded-xl transition-all group ${view === 'years' ? 'bg-blue-600' : 'hover:bg-blue-50 dark:hover:bg-blue-900/10'}`}
                        >
                            <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${view === 'years' ? 'text-white' : 'text-gray-900 dark:text-white group-hover:text-blue-600'}`}>
                                {currentMonth.getFullYear()}
                            </span>
                        </button>
                    </div>
                </div>
                <div className={`flex items-start self-start ${compact ? 'gap-2 pr-20' : 'gap-1.5 pr-16'}`}>
                {view === 'days' && (
                    <>
                            <button
                                disabled={currentMonth.getFullYear() === minDateValue.getFullYear() && currentMonth.getMonth() === minDateValue.getMonth()}
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
                                disabled={currentMonth.getFullYear() === maxDateValue.getFullYear() && currentMonth.getMonth() === maxDateValue.getMonth()}
                                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-20"
                            >
                                <ChevronRight className="w-4 h-4 text-gray-500" />
                            </button>
                        </>
                    )}
                </div>
                {showCloseButton && (
                    <button
                        onClick={onClose}
                        className={`${compact ? 'right-4 top-1 h-7 w-7' : 'right-4 top-1.5 h-8 w-8'} absolute flex items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20`}
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className={`${compact ? 'min-h-[192px]' : 'min-h-[220px]'} flex items-center justify-center`}>
                <div className="w-full">
                    {view === 'days' && renderDays()}
                    {view === 'months' && renderMonths()}
                    {view === 'years' && renderYears()}
                </div>
            </div>

            <div className={`${compact ? 'pt-3 gap-3' : 'pt-4 gap-4'} border-t border-slate-100 dark:border-slate-800 flex items-center justify-between`}>
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
                        className={`${compact ? 'px-4' : 'px-6'} h-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50`}
                    >
                        Apply Range
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModernCalendar;
