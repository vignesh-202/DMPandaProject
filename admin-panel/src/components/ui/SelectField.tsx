import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export const SelectField = ({
    label,
    value,
    onChange,
    children,
    hint
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    children: React.ReactNode;
    hint?: string;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Extract options from children
    const options: { value: string; label: string }[] = [];
    React.Children.forEach(children, (child) => {
        if (React.isValidElement(child) && child.type === 'option') {
            const props = child.props as any;
            options.push({
                value: props.value,
                label: props.children,
            });
        } else if (Array.isArray(child)) {
            child.forEach((c) => {
                if (React.isValidElement(c) && c.type === 'option') {
                    const props = c.props as any;
                    options.push({
                        value: props.value,
                        label: props.children,
                    });
                }
            });
        }
    });

    const selectedOption = options.find((opt) => String(opt.value) === String(value)) || options[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="rounded-[24px] border border-border/70 bg-gradient-to-b from-background/80 to-card/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            {hint ? <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">{hint}</p> : null}
            <div className="relative mt-3" ref={dropdownRef}>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex w-full items-center justify-between rounded-[1.1rem] border border-border/90 bg-gradient-to-b from-card/98 to-input/98 px-4 py-3 text-left text-[0.875rem] font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_10px_-8px_rgba(0,0,0,0.1)] transition-colors hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                    <span className="block truncate">{selectedOption?.label || 'Select an option...'}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div className="absolute z-50 mt-2 max-h-60 w-full overflow-auto rounded-[1.1rem] border border-border/90 bg-card p-1 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.2)] backdrop-blur-xl">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                                    String(option.value) === String(value)
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-foreground hover:bg-muted/60'
                                }`}
                            >
                                <span className="block truncate">{option.label}</span>
                                {String(option.value) === String(value) && (
                                    <Check className="h-4 w-4 text-primary" />
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SelectField;
