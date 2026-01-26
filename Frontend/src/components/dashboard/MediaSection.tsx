import React, { useEffect, useState } from 'react';
import Card from '../ui/card';
import { Plus, RefreshCcw } from 'lucide-react';

interface MediaItem {
    id: string;
    media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
    media_url: string;
    thumbnail_url?: string;
    permalink: string;
    caption?: string;
    timestamp: string;
    has_automation?: boolean;
}

interface MediaSectionProps {
    title: string;
    type: 'reel' | 'post' | 'story';
    onCreateAutomation: (media: MediaItem) => void;
}

const MediaSection: React.FC<MediaSectionProps> = ({ title, type, onCreateAutomation }) => {
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortOrder, setSortOrder] = useState<'recent' | 'oldest'>('recent');

    const fetchMedia = async () => {
        setLoading(true);
        try {
            const res = await fetch(`http://localhost:5000/api/instagram/media?type=${type}`, {
                mode: 'cors',
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok) {
                setMediaItems(data.data || []);
            }
        } catch (err) {
            console.error("Failed to fetch media", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMedia();
    }, [type]);

    const sortedItems = [...mediaItems].sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();
        return sortOrder === 'recent' ? dateB - dateA : dateA - dateB;
    });

    const automationsSet = sortedItems.filter(item => item.has_automation);
    // Per requirements: "show all the reels/posts of the account which has automation already set"
    // But also "create button... show the user all his reels which can be ... set new automation"
    // This implies the main view allows toggling or seeing lists.
    // The requirement text:
    // "it should show all the reels of the account which has automation already set and a create button on top right corner... which show the user all his reels..."

    // So we probably want two modes: "Active Automations" (filtered list) and "Create Automation" (full list to pick from).
    // Step 6: "create button in centre of the main area if there is no existing automation was set."

    const [viewMode, setViewMode] = useState<'list' | 'create'>('list');

    // If no automations set, defaults to empty list with big create button.

    const toggleView = () => {
        setViewMode(viewMode === 'list' ? 'create' : 'list');
    };

    return (
        <div className="bg-white dark:bg-black p-6 rounded-lg h-full">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-black dark:text-white">{title}</h2>
                <div className="flex gap-2">
                    {viewMode === 'create' && (
                        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                            <button
                                onClick={() => setSortOrder('recent')}
                                className={`px-3 py-1 text-sm rounded-md transition-all ${sortOrder === 'recent' ? 'bg-white dark:bg-gray-700 shadow text-black dark:text-white' : 'text-gray-500'}`}
                            >
                                Recent
                            </button>
                            <button
                                onClick={() => setSortOrder('oldest')}
                                className={`px-3 py-1 text-sm rounded-md transition-all ${sortOrder === 'oldest' ? 'bg-white dark:bg-gray-700 shadow text-black dark:text-white' : 'text-gray-500'}`}
                            >
                                Oldest
                            </button>
                            {/* Custom date sort omitted for brevity, can add date picker later */}
                        </div>
                    )}

                    <button
                        onClick={toggleView}
                        className="bg-black hover:bg-gray-800 text-white dark:bg-white dark:text-black dark:hover:bg-gray-200 px-4 py-2 rounded-lg flex items-center transition-colors"
                    >
                        {viewMode === 'list' ? (
                            <>
                                <Plus className="w-4 h-4 mr-2" />
                                Create Automation
                            </>
                        ) : (
                            <>Back to List</>
                        )}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <RefreshCcw className="w-8 h-8 animate-spin text-gray-500" />
                </div>
            ) : (
                <>
                    {viewMode === 'list' && automationsSet.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
                            <p className="text-gray-500 mb-4">No automations set for {type}s yet</p>
                            <button
                                onClick={() => setViewMode('create')}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl flex items-center shadow-lg transition-transform hover:scale-105"
                            >
                                <Plus className="w-5 h-5 mr-2" />
                                Create Your First Automation
                            </button>
                        </div>
                    )}

                    {viewMode === 'list' && automationsSet.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {/* Render Active Automations */}
                            {automationsSet.map(item => (
                                <div key={item.id} className="relative group">
                                    {/* Media Card for Automation */}
                                    <p>Automation Item {item.id}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {viewMode === 'create' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {sortedItems.map((item) => (
                                <Card key={item.id} className="overflow-hidden p-0 border-0 group cursor-pointer hover:ring-2 ring-blue-500 transition-all">
                                    <div className="relative aspect-[9/16] bg-gray-200 dark:bg-gray-800">
                                        {item.media_type === 'VIDEO' || item.media_type === 'CAROUSEL_ALBUM' ? (
                                            <img
                                                src={item.thumbnail_url || item.media_url}
                                                alt={item.caption || "Media"}
                                                className="object-cover w-full h-full"
                                            />
                                        ) : (
                                            <img
                                                src={item.media_url}
                                                alt={item.caption || "Media"}
                                                className="object-cover w-full h-full"
                                            />
                                        )}
                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                                            <button
                                                onClick={() => onCreateAutomation(item)}
                                                className="opacity-0 group-hover:opacity-100 bg-white text-black px-4 py-2 rounded-full font-bold transform translate-y-4 group-hover:translate-y-0 transition-all"
                                            >
                                                Select
                                            </button>
                                        </div>
                                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent text-white text-xs truncate">
                                            {new Date(item.timestamp).toLocaleDateString()}
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default MediaSection;
