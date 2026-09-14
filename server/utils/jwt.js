import jwt from 'jsonwebtoken';

/**
 * Generate JSON Web Token
 * @param {string} userId
 * @returns {string} Signed JWT token
 */
export const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET || 'fallback_secret_development_key';
  return jwt.sign({ id: userId }, secret, {
    expiresIn: '30d',
  });
};

/**
 * Verify JSON Web Token
 * @param {string} token
 * @returns {object} Decoded token payload
 */
export const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET || 'fallback_secret_development_key';
  return jwt.verify(token, secret);
};
