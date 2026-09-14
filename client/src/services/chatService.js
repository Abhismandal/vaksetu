import api from '../api/axios';

export const chatService = {
  // Get all conversations
  async getConversations() {
    const response = await api.get('/conversations');
    return response.data;
  },

  // Start or fetch existing 1-on-1 conversation
  async createOrGetConversation(recipientId) {
    const response = await api.post('/conversations', { recipientId });
    return response.data;
  },

  // Fetch messages with pagination
  async getMessages(conversationId, page = 1, limit = 30) {
    const response = await api.get(`/conversations/${conversationId}/messages`, {
      params: { page, limit },
    });
    return response.data;
  },

  // Send message
  async sendMessage(messageData) {
    const response = await api.post('/messages', messageData);
    return response.data;
  },

  // Edit message
  async editMessage(messageId, text) {
    const response = await api.put(`/messages/${messageId}`, { text });
    return response.data;
  },

  // Soft delete message
  async deleteMessage(messageId) {
    const response = await api.delete(`/messages/${messageId}`);
    return response.data;
  },

  // React to message
  async reactToMessage(messageId, emoji) {
    const response = await api.post(`/messages/${messageId}/reactions`, { emoji });
    return response.data;
  },

  // Toggle pin on message
  async togglePinMessage(messageId) {
    const response = await api.put(`/messages/${messageId}/pin`);
    return response.data;
  },

  // Toggle pin on conversation
  async togglePinConversation(conversationId) {
    const response = await api.put(`/conversations/${conversationId}/pin`);
    return response.data;
  },

  // Batch delete messages
  async batchDeleteMessages(messageIds) {
    const response = await api.post('/messages/batch-delete', { messageIds });
    return response.data;
  },

  // Search users
  async searchUsers(query) {
    const response = await api.get('/users', {
      params: { search: query },
    });
    return response.data;
  },

  // Upload single file
  async uploadFile(file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/upload/single', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });
    return response.data;
  },

  // Upload multiple files
  async uploadFiles(files, onProgress) {
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });
    const response = await api.post('/upload/multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });
    return response.data;
  },

  // Delete uploaded file
  async deleteUploadedFile(filename) {
    const response = await api.delete(`/upload/${filename}`);
    return response.data;
  },

  // Create new group
  async createGroup(data) {
    const response = await api.post('/groups', data);
    return response.data;
  },

  // Get group details
  async getGroupDetails(groupId) {
    const response = await api.get(`/groups/${groupId}`);
    return response.data;
  },

  // Update group details
  async updateGroup(groupId, data) {
    const response = await api.put(`/groups/${groupId}`, data);
    return response.data;
  },

  // Add members to group
  async addGroupMembers(groupId, memberIds) {
    const response = await api.post(`/groups/${groupId}/members`, { memberIds });
    return response.data;
  },

  // Remove member from group
  async removeGroupMember(groupId, memberId) {
    const response = await api.delete(`/groups/${groupId}/members/${memberId}`);
    return response.data;
  },

  // Toggle admin status of member
  async toggleGroupAdmin(groupId, memberId) {
    const response = await api.put(`/groups/${groupId}/admins/${memberId}`);
    return response.data;
  },

  // Global search across messages, conversations, and users
  async searchAll(query, options = {}) {
    const params = new URLSearchParams({ q: query });
    if (options.type) params.append('type', options.type);
    if (options.conversationId) params.append('conversationId', options.conversationId);
    if (options.limit) params.append('limit', options.limit);
    const response = await api.get(`/search?${params.toString()}`);
    return response.data;
  },

  // Scoped search inside a specific conversation
  async searchInConversation(conversationId, query) {
    const params = new URLSearchParams({ q: query, conversationId, type: 'messages' });
    const response = await api.get(`/search?${params.toString()}`);
    return response.data;
  },

  // Get notifications
  async getNotifications(page = 1, limit = 30) {
    const response = await api.get(`/notifications?page=${page}&limit=${limit}`);
    return response.data;
  },

  // Mark single notification as read
  async markNotificationRead(id) {
    const response = await api.put(`/notifications/${id}/read`);
    return response.data;
  },

  // Mark all notifications as read
  async markAllNotificationsRead() {
    const response = await api.put('/notifications/read-all');
    return response.data;
  },

  // Delete single notification
  async deleteNotification(id) {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
  },

  // Clear all notifications
  async clearAllNotifications() {
    const response = await api.delete('/notifications');
    return response.data;
  },

  // Get or initialize AI conversation
  async getAiConversation() {
    const response = await api.get('/ai/conversation');
    return response.data;
  },

  // Standard non-streaming AI chat
  async chatWithAi(data) {
    const response = await api.post('/ai/chat', data);
    return response.data;
  },

  // SSE streaming AI chat
  async streamAiResponse({
    message,
    messages = [],
    conversationId,
    onChunk = () => {},
    onDone = () => {},
    onError = () => {},
    signal,
  }) {
    try {
      const rawBaseURL = import.meta.env.VITE_API_URL || 'https://vaksetu.onrender.com/api';
      const baseURL = rawBaseURL.replace('vaksetu-api.onrender.com', 'vaksetu.onrender.com');

      const response = await fetch(`${baseURL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          messages,
          conversationId,
          stream: true,
        }),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `AI stream failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') {
            onDone();
            return;
          }

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.chunk) {
              onChunk(parsed.chunk);
            } else if (parsed.error) {
              throw new Error(parsed.error);
            }
          } catch (e) {
            // Incomplete JSON chunk
          }
        }
      }

      onDone();
    } catch (err) {
      if (err.name === 'AbortError') {
        onDone();
      } else {
        onError(err);
      }
    }
  },

  // AI Message Rewrite (professional, casual, concise, fix_grammar)
  async rewriteMessage(text, style = 'professional') {
    const response = await api.post('/ai/rewrite', { text, style });
    return response.data;
  },

  // AI Message Translation
  async translateMessage(text, targetLanguage = 'Spanish', messageId = null) {
    const response = await api.post('/ai/translate', { text, targetLanguage, messageId });
    return response.data;
  },

  // AI Conversation Summarization
  async summarizeConversation(conversationId, messages = []) {
    const response = await api.post('/ai/summarize', { conversationId, messages });
    return response.data;
  },

  // AI Contextual Smart Replies
  async getSmartReplies(conversationId, messages = []) {
    const response = await api.post('/ai/smart-replies', { conversationId, messages });
    return response.data;
  },

  // Toggle star status on message
  async toggleStarMessage(messageId) {
    const response = await api.post(`/messages/${messageId}/star`);
    return response.data;
  },

  // Get starred messages
  async getStarredMessages(conversationId = null) {
    const params = conversationId ? `?conversationId=${conversationId}` : '';
    const response = await api.get(`/messages/starred${params}`);
    return response.data;
  },

  // Get pinned messages for conversation
  async getPinnedMessages(conversationId) {
    const response = await api.get(`/messages/pinned/${conversationId}`);
    return response.data;
  },

  // Get shared media, docs, audio & links for conversation
  async getConversationMedia(conversationId) {
    const response = await api.get(`/messages/media/${conversationId}`);
    return response.data;
  },

  // Update logged in user's public encryption key
  async updatePublicKey(publicKey) {
    const response = await api.put('/users/public-key', { publicKey });
    return response.data;
  },

  // Fetch another user's public encryption key
  async getUserPublicKey(userId) {
    const response = await api.get(`/users/${userId}/public-key`);
    return response.data;
  },
};

export default chatService;
