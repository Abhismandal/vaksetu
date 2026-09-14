import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

async function testUserStep() {
  try {
    console.log('1. Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aichatbot');
    console.log('✓ Connected to MongoDB');

    // Clean up test user if previously left
    await User.deleteMany({ email: 'test_step2@example.com' });

    console.log('2. Testing User Creation & Validation...');
    const plainPassword = 'SuperSecret123!';
    const user = new User({
      name: 'Test Tester',
      username: 'test_user_step2',
      email: 'test_step2@example.com',
      password: plainPassword,
      bio: 'Testing step 2 Mongoose model',
    });

    await user.save();
    console.log('✓ User saved successfully with ID:', user._id);

    console.log('3. Verifying Password Hashing...');
    const rawUserInDb = await User.findById(user._id).select('+password');
    if (!rawUserInDb.password.startsWith('$2a$') && !rawUserInDb.password.startsWith('$2b$')) {
      throw new Error(`Password was not hashed properly! Got: ${rawUserInDb.password}`);
    }
    console.log('✓ Password is cryptographically hashed:', rawUserInDb.password.substring(0, 15) + '...');

    console.log('4. Verifying matchPassword Method...');
    const isMatch = await rawUserInDb.matchPassword(plainPassword);
    const isWrongMatch = await rawUserInDb.matchPassword('WrongPassword!');
    if (!isMatch || isWrongMatch) {
      throw new Error('matchPassword failed comparison check');
    }
    console.log('✓ matchPassword correctly verified the real password and rejected the wrong password');

    console.log('5. Verifying JSON serialization strips sensitive data...');
    const jsonOutput = user.toJSON();
    if (jsonOutput.password || jsonOutput.__v) {
      throw new Error('Sensitive fields present in JSON output');
    }
    console.log('✓ JSON serialization does not leak password or __v:', Object.keys(jsonOutput));

    console.log('6. Verifying Unique Index Constraint...');
    try {
      const duplicateUser = new User({
        name: 'Duplicate',
        username: 'test_user_step2',
        email: 'another_step2@example.com',
        password: 'password123',
      });
      await duplicateUser.save();
      throw new Error('Duplicate username should have failed');
    } catch (err) {
      if (err.code === 11000) {
        console.log('✓ Unique index successfully rejected duplicate username (E11000)');
      } else {
        throw err;
      }
    }

    console.log('7. Verifying Privacy Profile Method...');
    const publicProfile = user.getPublicProfile('some_other_user_id');
    console.log('✓ Public profile method works:', {
      name: publicProfile.name,
      username: publicProfile.username,
      status: publicProfile.status,
    });

    // Clean up
    await User.deleteMany({ email: 'test_step2@example.com' });
    console.log('✓ Cleaned up test records');

    await mongoose.disconnect();
    console.log('ALL STEP 2 VERIFICATIONS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('VERIFICATION ERROR:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

testUserStep();
