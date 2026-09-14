import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  Check, 
  Loader2, 
  UserPlus 
} from 'lucide-react';
import UserAvatar from './UserAvatar';
import chatService from '../services/chatService';

export const AddMemberModal = ({ groupId, isOpen, onClose, existingMemberIds = [], onMembersAdded }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const fetchUsers = async () => {
      setIsSearching(true);
      try {
        const res = await chatService.searchUsers(searchQuery);
        if (res.success) {
          // Filter out users who are already in the group
          const filtered = (res.users || []).filter(
            (u) => !existingMemberIds.includes(u._id)
          );
          setSearchResults(filtered);
        }
      } catch (err) {
        console.error('Failed to search users:', err);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(fetchUsers, 250);
    return () => clearTimeout(timer);
  }, [isOpen, searchQuery, existingMemberIds]);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setSelectedUserIds([]);
      setSearchQuery('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSelect = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleAdd = async () => {
    if (selectedUserIds.length === 0) return;
    setIsSubmitting(true);
    setError('');

    try {
      const res = await chatService.addGroupMembers(groupId, selectedUserIds);
      if (res.success) {
        if (onMembersAdded) onMembersAdded(res.group);
        onClose();
      } else {
        setError(res.message || 'Failed to add members');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to add members');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UserPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Add Members to Group
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
          {error && (
            <div className="mb-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* List of selectable contacts */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isSearching ? (
            <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Searching...</span>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No contacts available to add
            </div>
          ) : (
            searchResults.map((user) => {
              const isSelected = selectedUserIds.includes(user._id);
              return (
                <div
                  key={user._id}
                  onClick={() => toggleSelect(user._id)}
                  className={`p-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <UserAvatar
                      src={user.avatar}
                      name={user.name}
                      size="sm"
                      isOnline={user.isOnline}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {user.name}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        @{user.username}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-md flex items-center justify-center border transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 px-4 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            disabled={selectedUserIds.length === 0 || isSubmitting}
            onClick={handleAdd}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 flex items-center space-x-1.5 shadow-sm transition-all"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              `Add (${selectedUserIds.length})`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddMemberModal;
