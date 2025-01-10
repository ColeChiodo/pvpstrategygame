import bcrypt from "bcrypt";
import User from "./model";

const register = async (email: string, username: string, password: string) => {
    console.log("registering user");

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const user = new User({
        email,
        username,
        password: hash,
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

export default { register, login };