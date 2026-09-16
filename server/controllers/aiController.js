import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import {
  chatCompletion,
  streamChatCompletion,
  rewriteMessage,
  translateMessage,
  summarizeMessages,
  generateSmartReplies,
  getAiConfig,
  getOpenAIClient,
} from '../services/aiService.js';

/**
 * @desc    Find or create user AI conversation with history
 * @route   GET /api/ai/conversation
 * @access  Private
 */
export const getAiConversation = async (req, res) => {
  try {
    const userId = req.user._id;

    let conversation = await Conversation.findOne({
      participants: userId,
      isAi: true,
    }).populate({
      path: 'lastMessage',
      populate: { path: 'sender', select: 'name username avatar' },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [userId],
        isAi: true,
        isGroup: false,
        name: 'AI Assistant',
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
        unreadCounts: [{ user: userId, count: 0 }],
      });
    }

    // Retrieve previous messages for this conversation
    const messages = await Message.find({
      conversation: conversation._id,
      isDeleted: false,
    })
      .populate('sender', 'name username avatar')
      .sort({ createdAt: 1 })
      .limit(50)
      .lean();

    return res.status(200).json({
      success: true,
      conversation,
      messages,
    });
  } catch (error) {
    console.error('[Get AI Conversation Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve AI conversation',
      error: error.message,
    });
  }
};

/**
 * @desc    Chat with AI Assistant (supports standard JSON or SSE streaming)
 * @route   POST /api/ai/chat
 * @access  Private
 */
export const chatWithAi = async (req, res) => {
  try {
    const userId = req.user._id;
    const { message, messages = [], conversationId, stream = false, model } = req.body;

    if (!message && (!messages || messages.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Message prompt is required',
      });
    }

    // Build context array
    const conversationHistory = [...messages];
    if (message && (!messages.length || messages[messages.length - 1].text !== message)) {
      conversationHistory.push({ role: 'user', content: message });
    }

    // 1. If SSE streaming requested
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      let assistantResponse = '';

      await streamChatCompletion({
        messages: conversationHistory,
        model,
        onChunk: (chunk) => {
          assistantResponse += chunk;
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        },
        onDone: async (fullText) => {
          // If conversationId is supplied, save to DB
          if (conversationId) {
            try {
              const aiMessage = await Message.create({
                conversation: conversationId,
                sender: userId, // or AI placeholder
                text: fullText,
                messageType: 'ai',
                readBy: [{ user: userId }],
              });

              await Conversation.findByIdAndUpdate(conversationId, {
                lastMessage: aiMessage._id,
                updatedAt: new Date(),
              });
            } catch (saveErr) {
              console.error('[Save AI Message Error]:', saveErr);
            }
          }

          res.write('data: [DONE]\n\n');
          res.end();
        },
        onError: (err) => {
          res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          res.end();
        },
      });

      return;
    }

    // 2. Non-streaming JSON response
    const aiResult = await chatCompletion({
      messages: conversationHistory,
      model,
    });

    let savedMessage = null;
    if (conversationId) {
      savedMessage = await Message.create({
        conversation: conversationId,
        sender: userId,
        text: aiResult.content,
        messageType: 'ai',
        readBy: [{ user: userId }],
      });

      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: savedMessage._id,
        updatedAt: new Date(),
      });
    }

    return res.status(200).json({
      success: true,
      content: aiResult.content,
      model: aiResult.model,
      usage: aiResult.usage,
      message: savedMessage,
    });
  } catch (error) {
    console.error('[AI Chat Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process AI chat request',
      error: error.message,
    });
  }
};

/**
 * @desc    Rewrite draft message (professional, casual, concise, fix_grammar)
 * @route   POST /api/ai/rewrite
 * @access  Private
 */
export const rewriteMessageController = async (req, res) => {
  try {
    const { text, style = 'professional' } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message text is required for rewriting',
      });
    }

    const result = await rewriteMessage({ text, style });

    return res.status(200).json({
      success: true,
      result: result.result,
      style: result.style || style,
    });
  } catch (error) {
    console.error('[AI Rewrite Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to rewrite message',
      error: error.message,
    });
  }
};

/**
 * @desc    Translate message to target language
 * @route   POST /api/ai/translate
 * @access  Private
 */
export const translateMessageController = async (req, res) => {
  try {
    const { text, targetLanguage = 'Spanish', messageId } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message text is required for translation',
      });
    }

    const result = await translateMessage({ text, targetLanguage });

    return res.status(200).json({
      success: true,
      translatedText: result.translatedText,
      targetLanguage: result.targetLanguage || targetLanguage,
      messageId: messageId || null,
    });
  } catch (error) {
    console.error('[AI Translate Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to translate message',
      error: error.message,
    });
  }
};

/**
 * @desc    Summarize conversation history
 * @route   POST /api/ai/summarize
 * @access  Private
 */
export const summarizeConversationController = async (req, res) => {
  try {
    const { conversationId, messages: passedMessages } = req.body;

    let messagesToSummarize = passedMessages || [];

    if ((!messagesToSummarize || messagesToSummarize.length === 0) && conversationId) {
      messagesToSummarize = await Message.find({
        conversation: conversationId,
        isDeleted: false,
      })
        .populate('sender', 'name username')
        .sort({ createdAt: 1 })
        .limit(100)
        .lean();
    }

    if (!messagesToSummarize || messagesToSummarize.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No messages found to summarize',
      });
    }

    const result = await summarizeMessages({ messages: messagesToSummarize });

    return res.status(200).json({
      success: true,
      summary: result.summary,
    });
  } catch (error) {
    console.error('[AI Summarize Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to summarize conversation',
      error: error.message,
    });
  }
};

/**
 * @desc    Generate contextual quick smart reply suggestions
 * @route   POST /api/ai/smart-replies
 * @access  Private
 */
export const getSmartRepliesController = async (req, res) => {
  try {
    const { conversationId, messages: passedMessages } = req.body;

    let messagesToAnalyze = passedMessages || [];

    if ((!messagesToAnalyze || messagesToAnalyze.length === 0) && conversationId) {
      messagesToAnalyze = await Message.find({
        conversation: conversationId,
        isDeleted: false,
      })
        .populate('sender', 'name username')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
      
      // Reverse to chronological order
      messagesToAnalyze.reverse();
    }

    const result = await generateSmartReplies({ messages: messagesToAnalyze });

    return res.status(200).json({
      success: true,
      suggestions: result.suggestions || [],
    });
  } catch (error) {
    console.error('[AI Smart Replies Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate smart replies',
      error: error.message,
    });
  }
};

/**
 * @desc    Get AI Provider Status & Diagnostics (with optional live ping test)
 * @route   GET /api/ai/status
 * @access  Public
 */
export const getAiStatus = async (req, res) => {
  try {
    const config = getAiConfig();
    const shouldTest = req.query.test === 'true';

    const maskedKey = config.apiKey
      ? `${config.apiKey.slice(0, 7)}...${config.apiKey.slice(-4)}`
      : null;

    const statusResponse = {
      success: true,
      configured: config.isConfigured,
      provider: config.provider,
      model: config.model,
      baseURL: config.baseURL || 'https://api.openai.com/v1 (default)',
      keyConfigured: Boolean(config.apiKey),
      keyPreview: maskedKey,
      timestamp: new Date().toISOString(),
    };

    if (shouldTest && config.isConfigured) {
      const startTime = Date.now();
      try {
        const client = getOpenAIClient();
        const testRes = await client.chat.completions.create({
          model: config.model,
          messages: [{ role: 'user', content: 'Say "pong"' }],
          max_tokens: 10,
          temperature: 0.1,
        });
        const latencyMs = Date.now() - startTime;
        statusResponse.liveTest = {
          success: true,
          latencyMs,
          modelUsed: testRes.model || config.model,
          response: testRes.choices[0]?.message?.content?.trim() || '',
        };
      } catch (testErr) {
        statusResponse.liveTest = {
          success: false,
          error: testErr.message,
          status: testErr.status,
          code: testErr.code,
        };
      }
    }

    return res.status(200).json(statusResponse);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve AI status',
      error: error.message,
    });
  }
};
