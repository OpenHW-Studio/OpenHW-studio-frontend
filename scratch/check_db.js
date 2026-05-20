import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../openhw-studio-backend/.env') });

const User = mongoose.model('User', new mongoose.Schema({
    email: String,
    role: String
}));

async function check() {
    try {
        console.log("Connecting to:", process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        const targetId = '69ba8ea8e6a1d4c7b140761b';
        const user = await User.findById(targetId);
        if (user) {
            console.log("Found target user:", user.email, "Role:", user.role);
        } else {
            console.log("Target user NOT FOUND in database:", targetId);
            const all = await User.find({}).limit(5);
            console.log("Other users in DB:", all.map(u => u.email));
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
