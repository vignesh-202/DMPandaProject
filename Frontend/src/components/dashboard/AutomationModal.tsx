import React, { useState } from 'react';
import { X, Save, Key, MessageSquare } from 'lucide-react';

interface AutomationModalProps {
    isOpen: boolean;
    onClose: () => void;
    media: any;
    onSave: (keyword: string, reply: string) => void;
    title?: string;
}

const AutomationModal: React.FC<AutomationModalProps> = ({ isOpen, onClose, media, onSave, title = "Create Automation" }) => {
    const [keyword, setKeyword] = useState('');
    const [reply, setReply] = useState('');

    if (!isOpen || !media) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(keyword, reply);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl mb-4 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                            {media.media_type === 'VIDEO' || media.media_product_type === 'REELS' ? (
                                <img src={media.thumbnail_url || media.media_url} alt="Media" className="w-full h-full object-cover" />
                            ) : (
                                <img src={media.media_url} alt="Media" className="w-full h-full object-cover" />
                            )}
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Target Content</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[200px]">ID: {media.id}</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                            <Key className="w-4 h-4 text-blue-500" /> Trigger Keyword
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. 'price', 'info', 'coupon'"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                        <p className="text-xs text-gray-500 mt-1">If a user replies with this word, the automation will run.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-green-500" /> Automated Reply
                        </label>
                        <textarea
                            required
                            rows={3}
                            placeholder="Type your message here..."
                            value={reply}
                            onChange={(e) => setReply(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                            <Save className="w-5 h-5" />
                            Save Automation
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AutomationModal;
