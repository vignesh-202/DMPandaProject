import React, { useEffect, useState } from 'react';
import Card from '../ui/card';
import { TrendingUp, Instagram } from 'lucide-react';

interface InstagramStatsData {
    followers: number;
    media_count: number;
    username: string;
    profile_picture_url: string;
}

const InstagramStats: React.FC = () => {
    const [stats, setStats] = useState<InstagramStatsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('http://localhost:5000/api/instagram/stats', {
            mode: 'cors',
            credentials: 'include'
        })
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch');
                return res.json();
            })
            .then(data => {
                if (!data.error) {
                    setStats(data);
                }
                setLoading(false);
            })
            .catch(() => {
                // console.error(err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <Card>
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                </div>
            </Card>
        );
    }

    if (!stats) {
        return (
            <Card>
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>Instagram</h3>
                <p className="text-sm text-gray-500 mb-2">Link account to see stats.</p>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>Followers</h3>
                <div className="text-4xl font-bold mb-2" style={{ color: 'var(--text)' }}>{stats.followers}</div>
                <p className="text-green-500 text-sm flex items-center">
                    <Instagram className="w-4 h-4 mr-1" /> @{stats.username}
                </p>
            </Card>

            <Card>
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>Total Posts</h3>
                <div className="text-4xl font-bold mb-2" style={{ color: 'var(--text)' }}>{stats.media_count}</div>
                <p className="text-gray-500 text-sm flex items-center">
                    <TrendingUp className="w-4 h-4 mr-1" /> Lifetime
                </p>
            </Card>
        </>
    );
};

export default InstagramStats;
