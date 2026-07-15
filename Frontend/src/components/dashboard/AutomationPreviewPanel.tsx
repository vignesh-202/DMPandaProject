import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Eye, X } from 'lucide-react';
import { FAST_TRANSITION } from '../../lib/animation';

// Cosmic Dust/Glitter Canvas Animation Background
const SpaceDustBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let width = canvas.width = canvas.offsetWidth;
        let height = canvas.height = canvas.offsetHeight;

        // Space dust/glitter particles
        const particles: Array<{
            x: number;
            y: number;
            radius: number;
            vx: number;
            vy: number;
            alpha: number;
            alphaSpeed: number;
            color: string;
            phase: number;
        }> = [];

        const colors = [
            'rgba(147, 51, 234, ',  // Purple
            'rgba(236, 72, 153, ',  // Pink
            'rgba(249, 115, 22, ',  // Orange
            'rgba(59, 130, 246, ',  // Blue
            'rgba(255, 255, 255, ', // White/Twinkle
        ];

        // Create particles
        const particleCount = 35;
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: Math.random() * 1.5 + 0.5,
                vx: (Math.random() - 0.5) * 0.15,
                vy: -Math.random() * 0.2 - 0.05, // slowly drifting up
                alpha: Math.random() * 0.5 + 0.1,
                alphaSpeed: Math.random() * 0.015 + 0.005,
                color: colors[Math.floor(Math.random() * colors.length)],
                phase: Math.random() * Math.PI * 2,
            });
        }

        const handleResize = () => {
            if (!canvas) return;
            width = canvas.width = canvas.offsetWidth;
            height = canvas.height = canvas.offsetHeight;
        };

        window.addEventListener('resize', handleResize);

        // Animation Loop
        const render = () => {
            if (!canvas || !ctx) return;
            ctx.clearRect(0, 0, width, height);

            const isDarkMode = document.documentElement.classList.contains('dark');
            const cx = width / 2;
            const cy = height / 2;
            // Radius goes to the outer corners
            const r = Math.sqrt(cx * cx + cy * cy);
            const gradient = ctx.createRadialGradient(cx, cy, 20, cx, cy, r);
            
            if (isDarkMode) {
                // Cosmic dark mode glow that fades to transparent at edges
                gradient.addColorStop(0, 'rgba(15, 10, 32, 0.75)');
                gradient.addColorStop(0.5, 'rgba(10, 6, 22, 0.45)');
                gradient.addColorStop(1, 'rgba(5, 3, 10, 0)');
            } else {
                // Vibrant pastel glow that fades to transparent at edges
                gradient.addColorStop(0, 'rgba(238, 242, 255, 0.9)');
                gradient.addColorStop(0.5, 'rgba(250, 245, 255, 0.45)');
                gradient.addColorStop(1, 'rgba(253, 244, 255, 0)');
            }
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            // Draw particles
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                
                // Update position
                p.x += p.vx;
                p.y += p.vy;

                // Wrap around edges
                if (p.x < 0) p.x = width;
                if (p.x > width) p.x = 0;
                if (p.y < 0) p.y = height;
                if (p.y > height) p.y = height;

                // Twinkle effect (sine wave alpha)
                p.phase += p.alphaSpeed;
                const currentAlpha = (Math.sin(p.phase) + 1) * 0.5 * p.alpha;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = p.color + currentAlpha + ')';
                ctx.shadowBlur = p.radius * 2;
                ctx.shadowColor = p.color.includes('255, 255') ? '#fff' : p.color + '1)';
                ctx.fill();
            }

            animationFrameId = requestAnimationFrame(render);
        };

        animationFrameId = requestAnimationFrame(render);

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ display: 'block' }}
        />
    );
};

interface AutomationPreviewPanelProps {
    children: React.ReactNode;
    title?: string;
    minHeightClassName?: string;
    wrapperClassName?: string;
    showMobileTrigger?: boolean;
    mobileTriggerLabel?: string;
    breakpoint?: 'md' | 'lg' | 'xl';
}

const AutomationPreviewPanel: React.FC<AutomationPreviewPanelProps> = ({
    children,
    title,
    minHeightClassName = '',
    wrapperClassName = '',
    showMobileTrigger = true,
    mobileTriggerLabel = 'Live Preview',
    breakpoint = 'xl',
}) => {
    const [showModal, setShowModal] = useState(false);

    // Determine responsive classes based on breakpoint
    const breakpointClasses = {
        md: {
            inline: 'hidden md:block',
            trigger: 'md:hidden',
            modal: 'md:hidden',
        },
        lg: {
            inline: 'hidden lg:block',
            trigger: 'lg:hidden',
            modal: 'lg:hidden',
        },
        xl: {
            inline: 'hidden xl:block',
            trigger: 'xl:hidden',
            modal: 'xl:hidden',
        },
    }[breakpoint];

    const finalWrapperClassName = wrapperClassName || `order-2 min-h-0 w-full xl:order-2 xl:col-span-4 xl:self-start xl:max-h-[calc(100vh-7rem)] ${breakpointClasses.inline}`;

    return (
        <>
            <div className={finalWrapperClassName}>
                <div className="md:sticky md:top-4 xl:top-6">
                    {title && (
                        <div className="mb-4 text-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</span>
                        </div>
                    )}
                    <div className={`relative flex flex-col items-center justify-center overflow-hidden p-5 ${minHeightClassName}`.trim()}>
                        <SpaceDustBackground />
                        <div className="relative z-10 w-full flex flex-col items-center justify-center overflow-hidden">
                            {children}
                        </div>
                    </div>
                </div>
            </div>

            {showMobileTrigger && createPortal(
                <div className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[110] w-auto max-w-[calc(100%-2rem)] -translate-x-1/2 px-1 ${breakpointClasses.trigger}`}>
                    <button
                        type="button"
                        onClick={() => setShowModal(true)}
                        className={`inline-flex min-h-11 min-w-[12rem] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-ig-purple via-ig-pink to-ig-orange px-5 py-3 text-white shadow-xl ${FAST_TRANSITION} hover:shadow-2xl active:scale-[0.99] hover:scale-105 transition-all`}
                    >
                        <Eye className="h-[18px] w-[18px] flex-shrink-0" />
                        <span className="whitespace-nowrap text-sm font-bold leading-none">{mobileTriggerLabel}</span>
                    </button>
                </div>,
                document.body
            )}

            {showMobileTrigger && showModal && createPortal(
                <div
                    className={`fixed inset-0 z-[200] flex items-end justify-center bg-black/65 p-3 backdrop-blur-md animate-in fade-in duration-200 sm:items-center sm:p-4 ${breakpointClasses.modal}`}
                    onClick={() => setShowModal(false)}
                >
                    <div
                        className="relative flex h-[min(100dvh-1.5rem,46rem)] w-full max-w-[24rem] flex-col animate-in zoom-in-95 duration-200 sm:h-auto sm:max-h-[min(88vh,46rem)] sm:max-w-md"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className={`absolute right-2 top-3 z-10 rounded-full bg-black/25 p-2 text-white backdrop-blur-md hover:bg-black/40 sm:-top-12 sm:bg-white/10 sm:hover:bg-white/20 ${FAST_TRANSITION}`}
                            aria-label="Close preview"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        {title && (
                            <div className="mb-3 text-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/70">{title}</span>
                            </div>
                        )}
                        <div className="flex min-h-0 flex-1 overflow-visible">
                            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-visible px-2 py-4 sm:p-6">
                                <SpaceDustBackground />
                                <div className="relative z-10 flex flex-col items-center justify-center w-full h-auto max-h-full">
                                    {children}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default AutomationPreviewPanel;
