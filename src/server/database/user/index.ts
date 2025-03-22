import bcrypt from "bcrypt";
import User from "./model";

const register = async (email: string, username: string, password: string) => {
    console.log("registering user");

    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
        throw new Error("Email already in use.");
    }

    var filter = require('leo-profanity');
    if (filter.check(username)) {
        throw new Error("Username contains profanity.");
    }

    const existingUserByUsername = await User.findOne({ username });
    if (existingUserByUsername) {
        throw new Error("Username already in use.");
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const user = new User({
        email,
        username,
        password: hash,
        image: "default",
        totalGames: 0,
        totalWins: 0,
        win_streak: 0,
        xp: 0,
        currency: 0,
        premium_currency: 0,
    });

    return user.save();
};

const login = async (credential: string, password: string) => {
    console.log("logging in user");

    const user = await User.findOne({ $or: [{ email: credential }, { username: credential }] });
    if (!user) {
        throw new Error("User not found");
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
        throw new Error("Invalid password");
    }

    return user;
}

const deleteAccount = async (userID: string, email: string, password: string) => {
    console.log("deleting account");

    const user = await User.findOne({ _id: userID });
    if (!user) {
        throw new Error("User not found.");
    }

    if (user.email !== email) {
        throw new Error("Email does not match.");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        throw new Error("Invalid password.");
    }

    await User.deleteOne({ _id: user._id });

    return { message: "Account deleted successfully." };
};

const updateEmail = async (userId: string, newEmail: string) => {
    console.log("updating email");

    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found.");
    }

    const existingUserByEmail = await User.findOne({ email: newEmail });
    if (existingUserByEmail) {
        throw new Error("Email already in use.");
    }

    user.email = newEmail;
    await user.save();

    return { message: "Email updated successfully." };
};

const updateProfileImage = async (userId: string, newImage: string) => {
    console.log("updating profile image");

    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found.");
    }

    user.image = newImage;
    await user.save();

    return { message: "Profile Image updated successfully." };
};

const updateUsername = async (userId: string, newUsername: string) => {
    console.log("updating username");

    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found.");
    }

    var filter = require('leo-profanity');
    if (filter.check(newUsername)) {
        throw new Error("Username contains profanity.");
    }

    const existingUserByUsername = await User.findOne({ newUsername });
    if (existingUserByUsername) {
        throw new Error("Username already in use.");
    }

    user.username = newUsername;
    await user.save();

    return { message: "Username updated successfully." };
};

const updatePassword = async (userId: string, newPassword: string) => {
    console.log("updating password");

    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found.");
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);

    user.password = hash;
    await user.save();

    return { message: "Password updated successfully." };
};

const findById = async (userId: string) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error("User not found.");
        }
        return user;
    } catch (err) {
        console.error(err);
        throw new Error("Error fetching user by ID.");
    }
};

const incrementGamesPlayed = async (userId: string) => {
    console.log("Incrementing Games Played");

    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found.");
    }

    user.totalGames += 1;
    await user.save();

    return { message: "Games incremented successfully." };
};

const incrementGamesWon = async (userId: string) => {
    console.log("Incrementing Games Played");

    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found.");
    }

    user.totalWins += 1;
    incrementWinStreak(userId);
    await user.save();

    return { message: "Wins incremented successfully." };
};

const incrementWinStreak = async (userId: string) => {
    console.log("Incrementing Win Streak Played");

    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found.");
    }

    user.win_streak += 1;
    await user.save();

    return { message: "Win Streak incremented successfully." };
};

const resetWinStreak = async (userId: string) => {
    console.log("Resetting Win Streak Played");

    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found.");
    }

    user.win_streak = 0;
    await user.save();

    return { message: "Win Streak reset successfully." };
};

const incrementXP = async (userId: string, didWin: boolean) => {

    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found.");
    }

    const oldLvl = Math.floor(user.xp / 420) + 1;
    const baseXP = 50;
    const winXP = 120;
    const loseXP = 30;

    user.xp += didWin ? baseXP + winXP : baseXP + loseXP;
    await user.save();
    const newLvl = Math.floor(user.xp / 420) + 1;

    if (newLvl !== oldLvl) {
        incrementCurrency(userId, 100);
    }

    if (!didWin){
        resetWinStreak(userId);
    }

    return { message: "XP incremented successfully." };
};

const incrementCurrency = async (userId: string, amount: number) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found.");
    }

    user.currency += amount;
    await user.save();

    return { message: "Currency incremented successfully." };
};

const incrementPremiumCurrency = async (userId: string, amount: number) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found.");
    }

    user.premium_currency += amount;
    await user.save();

    return { 
        message: "Premium Currency converted successfully.",
        newPremium: user.premium_currency.toString(),
    };
};

const convertPremiumCurrency = async (userId: string, amount: number) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found.");
    }

    if (user.premium_currency - amount < 0) {
        throw new Error("Not Enough Premium Currency.");
    }

    user.premium_currency -= amount;
    user.currency += amount;
    await user.save();

    return { 
        message: "Premium Currency converted successfully.",
        newPremium: user.premium_currency.toString(),
        newCurrency: user.currency.toString(),
    };
};

export default { register, login, deleteAccount, updateEmail, updateUsername, updatePassword, updateProfileImage,
    findById, incrementGamesPlayed, incrementGamesWon, incrementXP, incrementPremiumCurrency, convertPremiumCurrency };