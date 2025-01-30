import mongoose, { Schema, Document } from 'mongoose';

interface IUser extends Document {
  email: string;
  username: string;
  password: string;
  image: string;
  totalGames: number;
  totalWins: number;
  xp: number;
  currency: number;
}

const userSchema: Schema = new Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  image: { type: String, required: true },
  totalGames: { type: Number, required: true },
  totalWins: { type: Number, required: true },
  xp: { type: Number, required: true },
  currency: { type: Number, required: true },
});

const User = mongoose.model<IUser>('User', userSchema);

export default User;
