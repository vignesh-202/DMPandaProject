import React, { useEffect, useState } from 'react';
import httpClient from '../lib/httpClient';
import type { Models } from 'appwrite';
import { Loader2, Search, Edit2, Check, X, Shield, Users as UsersIcon } from 'lucide-react';

interface UserDocument extends Models.Document {
    name: string;
    email: string;
    subscription_plan_id?: string;
    status?: string;
}

import { cn } from '../lib/utils';

export const UsersPage: React.FC = () => {
    const [users, setUsers] = useState<UserDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editFormData, setEditFormData] = useState<any>({});

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await httpClient.get('/admin/users');
            if (response.data?.users) {
                setUsers(response.data.users as UserDocument[]);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleEdit = (user: UserDocument) => {
        setEditingUserId(user.$id);
        setEditFormData({ ...user });
    };

    const handleSave = async (userId: string) => {
        try {
            const { $id, $createdAt, $updatedAt, $permissions, $collectionId, $databaseId, ...data } = editFormData;
            await httpClient.put(`/admin/users/${userId}`, data);
            setEditingUserId(null);
            fetchUsers();
        } catch (error) {
            console.error('Error updating user:', error);
            alert('Failed to update user');
        }
    };

    const filteredUsers = users.filter(user =>
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                <div>
                    <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">Users Management</h1>
                    <p className="text-gray-500 dark:text-neutral-400 mt-2 font-medium">Manage user accounts, subscriptions, and platform access.</p>
                </div>
                <div className="relative group w-full sm:w-80">
                    <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-neutral-700 to-transparent group-focus-within:via-black dark:group-focus-within:via-white transition-all duration-300" />
                    <Search className="w-4 h-4 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors" />
                    <input
                        type="text"
                        placeholder="Search users by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white dark:bg-[#0A0A0A] border border-gray-100 dark:border-neutral-800 rounded-2xl focus:outline-none shadow-sm text-sm font-medium transition-all"
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-[#0A0A0A] rounded-[32px] border border-gray-100 dark:border-neutral-800/50 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-50 dark:border-neutral-800/30 bg-gray-50/30 dark:bg-neutral-800/10">
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 dark:text-neutral-500 uppercase tracking-widest">User Profile</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 dark:text-neutral-500 uppercase tracking-widest">Subscription Tier</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 dark:text-neutral-500 uppercase tracking-widest">Account Status</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 dark:text-neutral-500 uppercase tracking-widest">Join Date</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 dark:text-neutral-500 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-neutral-800/30">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-4">
                                            <Loader2 className="w-8 h-8 animate-spin text-black dark:text-white opacity-20" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 animate-pulse">Fetching Users Registry...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-2 opacity-30">
                                            <UsersIcon className="w-10 h-10" />
                                            <p className="text-[10px] font-black uppercase tracking-widest">No matching users found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.$id} className="group hover:bg-gray-50/50 dark:hover:bg-neutral-800/20 transition-all duration-200">
                                        {editingUserId === user.$id ? (
                                            <>
                                                <td className="px-8 py-6">
                                                    <div className="space-y-2 max-w-xs">
                                                        <input
                                                            className="w-full px-3 py-2 text-sm font-bold bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl focus:ring-1 focus:ring-black dark:focus:ring-white outline-none"
                                                            value={editFormData.name}
                                                            onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                                                        />
                                                        <input
                                                            className="w-full px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 dark:bg-neutral-900/50 border border-transparent rounded-xl outline-none cursor-not-allowed"
                                                            value={editFormData.email}
                                                            disabled
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <select
                                                        className="w-full px-4 py-2.5 text-xs font-black uppercase tracking-widest bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl focus:ring-1 focus:ring-black dark:focus:ring-white outline-none cursor-pointer"
                                                        value={editFormData.subscription_plan_id || ''}
                                                        onChange={e => setEditFormData({ ...editFormData, subscription_plan_id: e.target.value })}
                                                    >
                                                        <option value="">FREE PLAN</option>
                                                        <option value="premium_monthly">PREMIUM MONTHLY</option>
                                                        <option value="premium_yearly">PREMIUM YEARLY</option>
                                                    </select>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Managed in Auth</span>
                                                </td>
                                                <td className="px-8 py-6 text-xs font-bold text-gray-400">
                                                    {new Date(user.$createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleSave(user.$id)}
                                                            className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-105 transition-transform"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingUserId(null)}
                                                            className="p-2.5 bg-red-500 text-white rounded-xl shadow-lg shadow-red-500/20 hover:scale-105 transition-transform"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="relative group-hover:scale-110 transition-transform duration-300">
                                                            <div className="absolute inset-0 bg-black dark:bg-white rounded-full blur-md opacity-0 group-hover:opacity-10 transition-opacity" />
                                                            <div className="relative w-11 h-11 rounded-full bg-gray-100 dark:from-neutral-800 dark:to-neutral-900 flex items-center justify-center text-gray-600 dark:text-neutral-300 font-black text-xs border-2 border-white dark:border-neutral-800 shadow-sm">
                                                                {user.name?.charAt(0) || 'U'}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-900 dark:text-white tracking-tight group-hover:text-black dark:group-hover:text-white transition-colors">{user.name}</p>
                                                            <p className="text-[10px] font-medium text-gray-500 dark:text-neutral-500">{user.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    {user.subscription_plan_id ? (
                                                        <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-900/10 dark:text-indigo-400 dark:border-indigo-900/20 shadow-sm shadow-indigo-500/5">
                                                            <Shield className="w-3 h-3 mr-2" />
                                                            {user.subscription_plan_id.replace('_', ' ')}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gray-50 text-gray-500 border border-gray-100 dark:bg-neutral-800/50 dark:text-neutral-500 dark:border-neutral-800/10">
                                                            Free Tier
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-8 py-6">
                                                    <span className={cn(
                                                        "inline-flex items-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest",
                                                        "text-emerald-600 bg-emerald-50 border border-emerald-100 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-900/20"
                                                    )}>
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                                                        Active
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6 text-xs font-bold text-gray-600 dark:text-neutral-400">
                                                    {new Date(user.$createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <button
                                                        onClick={() => handleEdit(user)}
                                                        className={cn(
                                                            "p-3 text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-2xl transition-all active:scale-90"
                                                        )}
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
