import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Image as ImageIcon, 
  FileText, 
  Pin, 
  Search, 
  Bell, 
  ShieldAlert, 
  Sparkles,
  Download,
  Calendar,
  AtSign,
  Mail,
  Info,
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  LogOut,
  Copy,
  Check,
  Trash2,
  Loader2,
  ExternalLink,
  Link2,
  Music,
  Mic,
  Film,
  CornerDownRight,
  Lock
} from 'lucide-react';
import UserAvatar from './UserAvatar';
import ImageModal from './ImageModal';
import AddMemberModal from './AddMemberModal';
import VoiceMessagePlayer from './VoiceMessagePlayer';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import chatService from '../services/chatService';

export const RightSidebar = () => {
  const { user } = useAuth();
  const { 
    activeConversation, 
    isRightSidebarOpen, 
    setIsRightSidebarOpen, 
    activeMessages,
    inConversationSearch,
    setInConversationSearch,
    loadConversations,
    setActiveConversation,
    pinnedMessages: contextPinnedMessages,
    togglePinMessage,
    jumpToMessage,
    setIsEncryptionModalOpen
  } = useChat();

  const [activeTab, setActiveTab] = useState('overview'); // overview, members, media, pinned
  const [gallerySubTab, setGallerySubTab] = useState('media'); // media, docs, links, audio
  const [mediaData, setMediaData] = useState({
    media: [],
    docs: [],
    audio: [],
    links: [],
    counts: { media: 0, docs: 0, audio: 0, links: 0 }
  });
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch complete media/docs/links/audio for conversation from backend
  useEffect(() => {
    if (!activeConversation?._id || activeConversation.isAi) {
      setMediaData({ media: [], docs: [], audio: [], links: [], counts: {} });
      return;
    }

    let isMounted = true;
    const fetchGallery = async () => {
      setLoadingMedia(true);
      try {
        const res = await chatService.getConversationMedia(activeConversation._id);
        if (isMounted && res.success) {
          setMediaData({
            media: res.media || [],
            docs: res.docs || [],
            audio: res.audio || [],
            links: res.links || [],
            counts: res.counts || {},
          });
        }
      } catch (err) {
        console.warn('[RightSidebar] Failed to load conversation media:', err);
      } finally {
        if (isMounted) setLoadingMedia(false);
      }
    };

    fetchGallery();
    return () => {
      isMounted = false;
    };
  }, [activeConversation?._id]);

  // Group helpers
  const isGroup = activeConversation?.isGroup;
  const group = activeConversation?.group;
  const groupAdmins = group?.admins || [];
  const isCurrentUserAdmin = groupAdmins.some(
    (a) => (a._id ? a._id.toString() : a.toString()) === user?._id?.toString()
  );
  const groupMembers = group?.members || activeConversation?.participants || [];

  const handleToggleAdmin = async (memberId) => {
    if (!group?._id) return;
    setActionLoading(true);
    try {
      await chatService.toggleGroupAdmin(group._id, memberId);
      await loadConversations();
    } catch (err) {
      console.error('Failed to toggle admin:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!group?._id) return;
    setActionLoading(true);
    try {
      await chatService.removeGroupMember(group._id, memberId);
      await loadConversations();
    } catch (err) {
      console.error('Failed to remove member:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!group?._id || !user?._id) return;
    if (window.confirm('Are you sure you want to leave this group?')) {
      setActionLoading(true);
      try {
        await chatService.removeGroupMember(group._id, user._id);
        await loadConversations();
        setActiveConversation(null);
      } catch (err) {
        console.error('Failed to leave group:', err);
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleCopyInvite = () => {
    if (group?.inviteCode) {
      navigator.clipboard.writeText(group.inviteCode);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    }
  };

  if (!isRightSidebarOpen || !activeConversation) return null;

  // Fallback extraction from activeMessages for real-time consistency
  const sharedMedia = [];
  const sharedFiles = [];
  const sharedAudio = [];
  const sharedLinks = [];
  const localPinnedMessages = [];

  const urlRegex = /(https?:\/\/[^\s]+)/g;

  activeMessages.forEach((msg) => {
    if (msg.pinned) {
      localPinnedMessages.push(msg);
    }
    if (msg.attachments && msg.attachments.length > 0) {
      msg.attachments.forEach((att) => {
        const item = { ...att, messageId: msg._id, sender: msg.sender, createdAt: msg.createdAt };
        if (att.type?.startsWith('image/') || att.type?.startsWith('video/')) {
          sharedMedia.push(item);
        } else if (att.type?.startsWith('audio/') || msg.messageType === 'voice') {
          sharedAudio.push(item);
        } else {
          sharedFiles.push(item);
        }
      });
    }
    if (msg.text) {
      const matches = msg.text.match(urlRegex);
      if (matches) {
        matches.forEach((url) => {
          sharedLinks.push({
            url,
            messageId: msg._id,
            sender: msg.sender,
            createdAt: msg.createdAt,
            contextText: msg.text,
          });
        });
      }
    }
  });

  const displayMedia = mediaData.media.length > 0 ? mediaData.media : sharedMedia;
  const displayDocs = mediaData.docs.length > 0 ? mediaData.docs : sharedFiles;
  const displayAudio = mediaData.audio.length > 0 ? mediaData.audio : sharedAudio;
  const displayLinks = mediaData.links.length > 0 ? mediaData.links : sharedLinks;
  const allPinnedMessages = (contextPinnedMessages && contextPinnedMessages.length > 0)
    ? contextPinnedMessages
    : localPinnedMessages;

  return (
    <aside className="w-full sm:w-72 md:w-80 flex-shrink-0 h-full flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200/80 dark:border-slate-800 transition-colors z-20">
      {/* Header */}
      <div className="h-16 px-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white">
          Chat Details
        </h3>
        <button
          onClick={() => setIsRightSidebarOpen(false)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Close details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Profile Card */}
        <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80">
          <UserAvatar
            src={activeConversation.avatar}
            name={activeConversation.name}
            size="xl"
            isOnline={activeConversation.isOnline}
            className="mb-3"
          />
          <h4 className="font-bold text-base text-slate-900 dark:text-white">
            {activeConversation.name}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            @{activeConversation.username || (activeConversation.isGroup ? 'group' : 'ai_assistant')}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 px-2 italic">
            "{activeConversation.status || activeConversation.description || 'Active in chat'}"
          </p>

          {activeConversation.isAi && (
            <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Powered by OpenAI
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className={`grid ${isGroup ? 'grid-cols-4' : 'grid-cols-3'} gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-400`}>
          {(isGroup
            ? [
                { id: 'overview', label: 'Info' },
                { id: 'members', label: `Members (${groupMembers.length})` },
                { id: 'media', label: 'Gallery' },
                { id: 'pinned', label: `Pinned (${allPinnedMessages.length})` },
              ]
            : [
                { id: 'overview', label: 'Info' },
                { id: 'media', label: 'Gallery' },
                { id: 'pinned', label: `Pinned (${allPinnedMessages.length})` },
              ]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-1.5 px-1 rounded-lg text-center truncate transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                  : 'hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-4 text-xs">
            {/* Search in chat */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-2 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-indigo-500" />
                Search Messages
              </span>
              <input
                type="text"
                value={inConversationSearch || ''}
                onChange={(e) => setInConversationSearch(e.target.value)}
                placeholder="Search this conversation..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Group Invite Code Card */}
            {isGroup && group?.inviteCode && (
              <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/80 space-y-1.5">
                <span className="font-semibold text-indigo-900 dark:text-indigo-300 block">
                  Group Invite Code
                </span>
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900/60 font-mono text-xs">
                  <span className="tracking-wider font-bold text-indigo-600 dark:text-indigo-400">
                    {group.inviteCode}
                  </span>
                  <button
                    onClick={handleCopyInvite}
                    className="p-1 rounded text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 text-[11px]"
                  >
                    {copiedInvite ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-500 font-semibold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Information attributes */}
            <div className="space-y-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <AtSign className="w-3.5 h-3.5" /> {isGroup ? 'Group Type' : 'Username'}
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {isGroup ? 'Private Group' : activeConversation.username || 'n/a'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Started
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  Recently
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5" /> Notifications
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Enabled
                </span>
              </div>
            </div>

            {/* End-to-End Encryption Card */}
            {!activeConversation.isAi && (
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-bold text-slate-900 dark:text-white text-xs">
                      End-to-End Encryption
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold">
                    Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Messages are end-to-end encrypted with RSA-OAEP and AES-GCM.
                </p>
                <button
                  onClick={() => setIsEncryptionModalOpen(true)}
                  className="w-full py-1.5 px-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] flex items-center justify-center space-x-1.5 border border-emerald-200/80 dark:border-emerald-800/80 transition-all shadow-2xs"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Verify Safety Number</span>
                </button>
              </div>
            )}

            {/* Leave Group Action for members */}
            {isGroup && (
              <div className="pt-2">
                <button
                  disabled={actionLoading}
                  onClick={handleLeaveGroup}
                  className="w-full py-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors border border-rose-200/60 dark:border-rose-900/60"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Leave Group</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Group Members Tab */}
        {isGroup && activeTab === 'members' && (
          <div className="space-y-3 text-xs">
            {/* Add member button (Admin only) */}
            {isCurrentUserAdmin && (
              <button
                onClick={() => setIsAddMemberModalOpen(true)}
                className="w-full py-2 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 font-semibold flex items-center justify-center space-x-1.5 transition-colors border border-indigo-200/80 dark:border-indigo-800/80"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Members</span>
              </button>
            )}

            {/* Members List */}
            <div className="space-y-1.5">
              {groupMembers.map((member) => {
                const memberId = member._id ? member._id.toString() : member.toString();
                const isAdmin = groupAdmins.some(
                  (a) => (a._id ? a._id.toString() : a.toString()) === memberId
                );
                const isMe = memberId === user?._id?.toString();

                return (
                  <div
                    key={memberId}
                    className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                      <UserAvatar
                        src={member.avatar}
                        name={member.name || 'Member'}
                        size="sm"
                        isOnline={member.isOnline}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">
                            {member.name || 'Member'}
                          </p>
                          {isMe && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              (You)
                            </span>
                          )}
                        </div>
                        {isAdmin ? (
                          <span className="inline-flex items-center space-x-0.5 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Admin</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Member</span>
                        )}
                      </div>
                    </div>

                    {/* Admin Actions on other members */}
                    {isCurrentUserAdmin && !isMe && (
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        <button
                          disabled={actionLoading}
                          onClick={() => handleToggleAdmin(memberId)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isAdmin
                              ? 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60'
                              : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                          title={isAdmin ? 'Demote from Admin' : 'Make Group Admin'}
                        >
                          <Shield className="w-3.5 h-3.5" />
                        </button>

                        <button
                          disabled={actionLoading}
                          onClick={() => handleRemoveMember(memberId)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          title="Remove from group"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Shared Gallery Tab (Media, Docs, Links, Audio) */}
        {activeTab === 'media' && (
          <div className="space-y-3">
            {/* Gallery Sub-tabs */}
            <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-[11px] font-medium text-slate-600 dark:text-slate-400">
              {[
                { id: 'media', label: 'Media', count: displayMedia.length, icon: ImageIcon },
                { id: 'docs', label: 'Docs', count: displayDocs.length, icon: FileText },
                { id: 'links', label: 'Links', count: displayLinks.length, icon: Link2 },
                { id: 'audio', label: 'Audio', count: displayAudio.length, icon: Mic },
              ].map((sub) => {
                const isSubActive = gallerySubTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setGallerySubTab(sub.id)}
                    className={`py-1.5 px-1 rounded-lg text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                      isSubActive
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                        : 'hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span className="truncate">{sub.label}</span>
                    <span className={`text-[10px] px-1 rounded-full ${
                      isSubActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold'
                        : 'text-slate-400'
                    }`}>
                      {sub.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {loadingMedia ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mb-2" />
                <p className="text-xs text-slate-500 dark:text-slate-400">Loading gallery...</p>
              </div>
            ) : (
              <div>
                {/* 1. Media: Images & Videos */}
                {gallerySubTab === 'media' && (
                  displayMedia.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No shared media yet in this conversation
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {displayMedia.map((m, i) => {
                        const isVideo = m.type?.startsWith('video/');
                        return (
                          <div
                            key={i}
                            className="relative group/media overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-black/5 dark:bg-black/30 aspect-square"
                          >
                            {isVideo ? (
                              <div
                                onClick={() => setSelectedImage({ url: m.url, name: m.name, isVideo: true })}
                                className="w-full h-full cursor-pointer flex flex-col items-center justify-center p-2 text-center"
                              >
                                <Film className="w-7 h-7 text-indigo-500 mb-1" />
                                <span className="text-[10px] text-slate-600 dark:text-slate-300 truncate w-full">
                                  {m.name || 'Video'}
                                </span>
                              </div>
                            ) : (
                              <img
                                src={m.url}
                                alt={m.name || 'Shared'}
                                onClick={() => setSelectedImage({ url: m.url, name: m.name })}
                                className="w-full h-full object-cover cursor-pointer hover:opacity-90 hover:scale-[1.03] transition-all"
                                loading="lazy"
                              />
                            )}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-between text-white text-[10px]">
                              <span className="truncate pr-1">{m.name || 'Media'}</span>
                              <a
                                href={m.url}
                                download={m.name || 'media'}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded hover:bg-white/20 text-white flex-shrink-0"
                                title="Download"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Download className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}

                {/* 2. Docs: Documents & PDFs */}
                {gallerySubTab === 'docs' && (
                  displayDocs.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No shared documents yet
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {displayDocs.map((f, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center space-x-2.5 truncate min-w-0 pr-2">
                            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 truncate">
                              <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                                {f.name || 'Document'}
                              </p>
                              <span className="text-[10px] text-slate-400">
                                {f.size ? (f.size > 1024 * 1024 ? `${(f.size / (1024 * 1024)).toFixed(2)} MB` : `${(f.size / 1024).toFixed(1)} KB`) : ''}
                                {f.createdAt ? ` • ${new Date(f.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : ''}
                              </span>
                            </div>
                          </div>
                          <a
                            href={f.url}
                            download={f.name || 'document'}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
                            title="Download document"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* 3. Links: Extracted URLs */}
                {gallerySubTab === 'links' && (
                  displayLinks.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      <Link2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No links shared yet in this chat
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {displayLinks.map((item, i) => {
                        let hostname = '';
                        try {
                          hostname = new URL(item.url).hostname;
                        } catch {
                          hostname = item.url;
                        }

                        return (
                          <div
                            key={i}
                            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800/60 transition-colors space-y-1.5 group/link"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold truncate max-w-[140px]">
                                {hostname}
                              </span>
                              <div className="flex items-center space-x-1">
                                {item.messageId && (
                                  <button
                                    onClick={() => jumpToMessage(item.messageId)}
                                    className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                    title="Jump to message in chat"
                                  >
                                    <CornerDownRight className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                  title="Open link"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline line-clamp-1 break-all block"
                            >
                              {item.url}
                            </a>
                            {item.contextText && item.contextText !== item.url && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 italic">
                                "{item.contextText}"
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                )}

                {/* 4. Audio: Voice messages & Audio clips */}
                {gallerySubTab === 'audio' && (
                  displayAudio.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      <Mic className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No voice or audio clips shared yet
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {displayAudio.map((a, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                              {a.sender?.name ? `${a.sender.name}'s voice note` : a.name || 'Voice Message'}
                            </span>
                            {a.messageId && (
                              <button
                                onClick={() => jumpToMessage(a.messageId)}
                                className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                                title="Jump to message"
                              >
                                <CornerDownRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <VoiceMessagePlayer
                            audioUrl={a.url}
                            duration={a.duration || 0}
                            isMe={false}
                            name={a.name}
                          />
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {/* Pinned Messages Tab */}
        {activeTab === 'pinned' && (
          <div className="space-y-2">
            {allPinnedMessages.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <Pin className="w-8 h-8 mx-auto mb-2 opacity-40 rotate-45" />
                No pinned messages in this chat
              </div>
            ) : (
              allPinnedMessages.map((m) => (
                <div
                  key={m._id}
                  onClick={() => jumpToMessage(m._id)}
                  className="p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-xs cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group/pin relative"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-indigo-900 dark:text-indigo-300">
                      {m.sender?.name || 'Sender'}
                    </span>
                    <div className="flex items-center space-x-1">
                      <span className="text-[10px] text-slate-400">
                        {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePinMessage(m._id);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/50 transition-colors"
                        title="Unpin message"
                      >
                        <Pin className="w-3 h-3 text-indigo-500 rotate-45" />
                      </button>
                    </div>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 line-clamp-3">
                    {m.text || (m.attachments?.length ? `📎 ${m.attachments[0].name || 'Attachment'}` : 'Message')}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Add Members Modal */}
      {isGroup && group?._id && (
        <AddMemberModal
          groupId={group._id}
          isOpen={isAddMemberModalOpen}
          onClose={() => setIsAddMemberModalOpen(false)}
          existingMemberIds={groupMembers.map((m) => (m._id ? m._id.toString() : m.toString()))}
          onMembersAdded={() => loadConversations()}
        />
      )}

      {/* Image Lightbox Modal */}
      <ImageModal
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        imageSrc={selectedImage?.url}
        imageName={selectedImage?.name}
      />
    </aside>
  );
};

export default RightSidebar;
