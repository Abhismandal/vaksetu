import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
      minlength: [2, 'Group name must be at least 2 characters long'],
      maxlength: [60, 'Group name cannot exceed 60 characters'],
    },
    avatar: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
      default: '',
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    inviteCode: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
groupSchema.index({ members: 1 });
groupSchema.index({ conversation: 1 });

// Helper methods
groupSchema.methods.isAdmin = function (userId) {
  if (!userId) return false;
  const targetId = userId._id ? userId._id.toString() : userId.toString();
  return this.admins.some((admin) => {
    const adminId = admin._id ? admin._id.toString() : admin.toString();
    return adminId === targetId;
  });
};

groupSchema.methods.isMember = function (userId) {
  if (!userId) return false;
  const targetId = userId._id ? userId._id.toString() : userId.toString();
  return this.members.some((member) => {
    const memberId = member._id ? member._id.toString() : member.toString();
    return memberId === targetId;
  });
};

const Group = mongoose.model('Group', groupSchema);

export default Group;
