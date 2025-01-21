import mongoose, { Schema, Document } from 'mongoose';

interface IUser extends Document {
  email: string;
  username: string;
  password: string;
  image: string;
}

const userSchema: Schema = new Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  image: { type: String, required: true }
});

const User = mongoose.model<IUser>('User', userSchema);

export default User;
