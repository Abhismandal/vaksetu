import User from '../models/User.js';

/**
 * @desc    Search and list users (excluding the requesting user)
 * @route   GET /api/users
 * @access  Private
 */
export const getUsers = async (req, res) => {
  try {
    const { search } = req.query;
    const query = { _id: { $ne: req.user._id } };

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: searchRegex }, { username: searchRegex }, { email: searchRegex }];
    }

    const users = await User.find(query)
      .select('name username email avatar bio status isOnline lastSeen privacy publicKey createdAt')
      .limit(30)
      .sort({ name: 1 });

    // Sanitize with privacy settings
    const sanitizedUsers = users.map((u) => u.getPublicProfile(req.user._id));

    return res.status(200).json({
      success: true,
      users: sanitizedUsers,
    });
  } catch (error) {
    console.error('[getUsers Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve users',
    });
  }
};

/**
 * @desc    Get user profile by ID
 * @route   GET /api/users/:id
 * @access  Private
 */
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      'name username email avatar bio status isOnline lastSeen privacy publicKey createdAt'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      user: user.getPublicProfile(req.user._id),
    });
  } catch (error) {
    console.error('[getUserById Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user',
    });
  }
};

/**
 * @desc    Update current user's public encryption key
 * @route   PUT /api/users/public-key
 * @access  Private
 */
export const updatePublicKey = async (req, res) => {
  try {
    const { publicKey } = req.body;
    if (!publicKey) {
      return res.status(400).json({
        success: false,
        message: 'Public key is required',
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { publicKey },
      { new: true }
    ).select('name username publicKey');

    return res.status(200).json({
      success: true,
      publicKey: user.publicKey,
      message: 'Public key updated successfully',
    });
  } catch (error) {
    console.error('[updatePublicKey Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update public key',
    });
  }
};

/**
 * @desc    Get user's public encryption key
 * @route   GET /api/users/:id/public-key
 * @access  Private
 */
export const getUserPublicKey = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('name username publicKey');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      userId: user._id,
      publicKey: user.publicKey || null,
    });
  } catch (error) {
    console.error('[getUserPublicKey Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user public key',
    });
  }
};
