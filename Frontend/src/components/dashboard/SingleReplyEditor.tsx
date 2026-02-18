import React, { useState, useEffect } from 'react';
import {
    MessageSquare, Save, Loader2, AlertCircle, CheckCircle2,
    FileText, Smartphone, MousePointerClick, Image as ImageIcon, Reply,
    Share2, Lightbulb
} from 'lucide-react';
import MobilePreview from './MobilePreview';
import { useDashboard } from '../../contexts/DashboardContext';
import Card from '../ui/card';

interface SingleReplyEditorProps {
    type: 'mention' | 'suggest_more' | 'global';
    title: string;
    description: string;
    authenticatedFetch: any;
    activeAccountID: string;
}

const SingleReplyEditor: React.FC<SingleReplyEditorProps> = ({
    type, title, description, authenticatedFetch, activeAccountID
}) => {
    const { activeAccount } = useDashboard();
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [automation, setAutomation] = useState<any>({
        title: title,
        template_type: 'template_text',
        template_content: '',
        active: true,
        type: type,
        $id: null
    });

    useEffect(() => {
        const fetchAutomation = async () => {
            setLoading(true);
            try {
                // Fetch existing automation of this type for this account
                const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations?account_id=${activeAccountID}&type=${type}`);
                const data = await res.json();
                if (res.ok && data.data && data.data.length > 0) {
                    setAutomation(data.data[0]);
                } else {
                    // Reset if none found
                    setAutomation({
                        title: title,
                        template_type: 'template_text',
                        template_content: '',
                        active: true,
                        type: type,
                        $id: null
                    });
                }
            } catch (err) {
                setError("Failed to load settings.");
            } finally {
                setLoading(false);
            }
        };

        if (activeAccountID) {
            fetchAutomation();
        }
    }, [activeAccountID, type, title, authenticatedFetch]);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations?account_id=${activeAccountID}`, {
                method: automation.$id ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...automation,
                    type: type,
                    title: title // Keep fixed title for these types
                })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.$id) setAutomation({ ...automation, $id: data.$id });
                setSuccess("Automation saved successfully!");
                setTimeout(() => setSuccess(null), 3000);
            } else {
                const data = await res.json();
                setError(data.error || "Failed to save.");
            }
        } catch (err) {
            setError("Network error.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh]">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                <p className="mt-4 text-xs font-black uppercase text-gray-400 tracking-widest">Loading Settings...</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in duration-500 pb-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 space-y-8">
                    <div className="bg-white dark:bg-gray-950 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <MessageSquare className="w-32 h-32" />
                        </div>
                        <div className="relative z-10">
                            <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">{title}</h1>
                            <p className="text-gray-500 dark:text-gray-400 font-medium max-w-lg">{description}</p>
                        </div>
                    </div>

                    <Card className="p-8 border-none shadow-xl bg-white dark:bg-gray-950 rounded-[40px] space-y-8">
                        {error && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-bold animate-in slide-in-from-top-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-3 text-green-600 text-xs font-bold animate-in slide-in-from-top-2">
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                {success}
                            </div>
                        )}

                        <div className="space-y-6">
                            <label className="text-[11px] font-black uppercase text-gray-400 tracking-[0.2em] px-1">Response Template</label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { id: 'template_text', icon: FileText, label: 'Text' },
                                    { id: 'template_carousel', icon: Smartphone, label: 'Carousel' },
                                    { id: 'template_buttons', icon: MousePointerClick, label: 'Button' },
                                    { id: 'template_media', icon: ImageIcon, label: 'Media' },
                                    { id: 'template_share_post', icon: Share2, label: 'Share Post' },
                                    { id: 'template_quick_replies', icon: Reply, label: 'Quick' },
                                ].map(tpl => (
                                    <button
                                        key={tpl.id}
                                        onClick={() => setAutomation({ ...automation, template_type: tpl.id })}
                                        className={`flex flex-col items-center p-5 gap-3 rounded-3xl border-2 transition-all group ${automation.template_type === tpl.id
                                            ? 'border-blue-500 bg-blue-500/5 dark:bg-blue-500/10 shadow-lg shadow-blue-500/10'
                                            : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                                            }`}
                                    >
                                        <div className={`p-3 rounded-xl transition-all ${automation.template_type === tpl.id ? 'bg-blue-500 text-white animate-in zoom-in-110' : 'bg-gray-100 dark:bg-gray-900 text-gray-400'}`}>
                                            <tpl.icon className="w-5 h-5" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest">{tpl.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[11px] font-black uppercase text-gray-400 tracking-[0.2em] px-1">Message Content</label>
                            <textarea
                                value={automation.template_content || ''}
                                onChange={e => setAutomation({ ...automation, template_content: e.target.value })}
                                className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-blue-500 rounded-3xl p-6 text-sm font-medium resize-none outline-none transition-all min-h-[160px] shadow-inner"
                                placeholder="Enter the automated response message here..."
                            />
                        </div>

                        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-6 rounded-full transition-all relative cursor-pointer ${automation.active ? 'bg-green-500' : 'bg-gray-200'}`} onClick={() => setAutomation({ ...automation, active: !automation.active })}>
                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${automation.active ? 'left-7' : 'left-1'}`} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Status: {automation.active ? 'Active' : 'Paused'}</span>
                            </div>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-500/30 flex items-center gap-3 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </Card>
                </div>

                <div className="lg:col-span-5 relative">
                    <div className="sticky top-8">
                        <MobilePreview
                            automation={automation}
                            displayName={activeAccount?.username || 'user'}
                            profilePic={activeAccount?.profile_pic}
                        />
                        <div className="text-center mt-6">
                            <span className="inline-block px-4 py-1.5 bg-gray-100 dark:bg-gray-900 rounded-full text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block mr-2" />
                                Real-time Preview
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SingleReplyEditor;
