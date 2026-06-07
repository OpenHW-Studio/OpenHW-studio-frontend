import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load from ../env
dotenv.config({ path: path.join(__dirname, '../env') });
// Also try root .env for standard environments
dotenv.config();

console.log('Environment variables loaded.');
