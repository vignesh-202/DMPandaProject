import React, { useEffect, useState } from 'react';
import httpClient from '../lib/httpClient';
import type { Models } from 'appwrite';
import { Loader2, Search, Edit2, Check, X, Shield } from 'lucide-react';

interface UserDocument extends Models.Document {
    name: string;
    email: string;
    subscription_plan_id?: string;
    status?: string;
}

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
            // Filter out system attributes
            const { $id, $createdAt, $updatedAt, $permissions, $collectionId, $databaseId, ...data } = editFormData;

            await httpClient.put(`/admin/users/${userId}`, data);

            setEditingUserId(null);
            fetchUsers(); // Refresh
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
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Users Management</h1>
                    <p className="text-gray-500">View and manage user accounts and subscriptions</p>
                </div>
                <div className="relative">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-64"
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subscription Plan</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        No users found matching your search.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.$id} className="hover:bg-gray-50 transition-colors">
                                        {editingUserId === user.$id ? (
                                            // Edit Mode
                                            <>
                                                <td className="px-6 py-4">
                                                    <input
                                                        className="border rounded px-2 py-1 w-full mb-1"
                                                        value={editFormData.name}
                                                        onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                                                    />
                                                    <input
                                                        className="border rounded px-2 py-1 w-full text-sm text-gray-500"
                                                        value={editFormData.email}
                                                        onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
                                                    />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <select
                                                        className="border rounded px-2 py-1 w-full"
                                                        value={editFormData.subscription_plan_id || ''}
                                                        onChange={e => setEditFormData({ ...editFormData, subscription_plan_id: e.target.value })}
                                                    >
                                                        <option value="">Free</option>
                                                        <option value="premium_monthly">Premium Monthly</option>
                                                        <option value="premium_yearly">Premium Yearly</option>
                                                    </select>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs px-2">
                                                        Stored in Auth
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {new Date(user.$createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right space-x-2">
                                                    <button
                                                        onClick={() => handleSave(user.$id)}
                                                        className="text-green-600 hover:text-green-800 p-1 bg-green-50 rounded"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingUserId(null)}
                                                        className="text-red-600 hover:text-red-800 p-1 bg-red-50 rounded"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </>
                                        ) : (
                                            // View Mode
                                            <>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs uppercase">
                                                            {user.name?.charAt(0) || 'U'}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-gray-900">{user.name}</p>
                                                            <p className="text-sm text-gray-500">{user.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {user.subscription_plan_id ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                                                            <Shield className="w-3 h-3 mr-1" />
                                                            {user.subscription_plan_id.replace('_', ' ').toUpperCase()}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                            FREE
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {/* We assume status is Active here, real status is in Auth */}
                                                    <span className="text-green-600 text-sm font-medium flex items-center">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-green-600 mr-2"></div>
                                                        Active
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {new Date(user.$createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => handleEdit(user)}
                                                        className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-lg transition-colors"
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
