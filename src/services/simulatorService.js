import axios from 'axios';

const COMPILER_URL = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}` : 'http://localhost:5000/api';

/**
 * Sends Arduino C++ code to the backend compiler.
 * @param {string} code - The C++ code to compile
 * @returns {Promise<string>} The Intel Hex string
 */
export async function compileCode(code) {
    try {
        const response = await axios.post(`${COMPILER_URL}/compile`, { code });
        if (response.data && response.data.hex) {
            return response.data;
        }
        throw new Error('No hex returned from compiler');
    } catch (error) {
        if (error.response && error.response.data && error.response.data.details) {
            throw new Error(`Compilation Failed:\n${error.response.data.details}`);
        }
        throw error;
    }
}
