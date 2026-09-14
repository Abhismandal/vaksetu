import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, 'Attachment URL is required'],
    },
    name: {
      type: String,
      default: 'attachment',
    },
    size: {
      type: Number,
      default: 0,
    },
    type: {
      type: String,
      default: 'application/octet-stream',
    },
    duration: {
      type: Number, // For voice/video audio messages in seconds
      default: 0,
    },
  },
  { _id: true }
);

const reactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    emoji: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const readBySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'Conversation reference is required'],
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender reference is required'],
      index: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    text: {
      type: String,
      default: '',
      trim: true,
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'video', 'file', 'audio', 'voice', 'ai', 'system'],
      default: 'text',
    },
    attachments: [attachmentSchema],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    reactions: [reactionSchema],
    isEdited: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    pinnedAt: {
      type: Date,
      default: null,
    },
    starredBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    readBy: [readBySchema],
    isEncrypted: {
      type: Boolean,
      default: false,
    },
    ciphertext: {
      type: String,
      default: null,
    },
    iv: {
      type: String,
      default: null,
    },
    encryptedKeys: [
      {
        recipient: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        key: {
          type: String,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for fast starred and pinned lookups
messageSchema.index({ starredBy: 1 });
messageSchema.index({ conversation: 1, pinned: 1 });

// Compound index for fast chronological conversation pagination
messageSchema.index({ conversation: 1, createdAt: -1 });

// Full text search index
messageSchema.index({ text: 'text' });

// Safe JSON transform for deleted messages
messageSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  if (obj.isDeleted) {
    obj.text = 'This message was deleted';
    obj.attachments = [];
    obj.ciphertext = null;
    obj.iv = null;
    obj.encryptedKeys = [];
  }
  return obj;
};

const Message = mongoose.model('Message', messageSchema);

export default Message;
