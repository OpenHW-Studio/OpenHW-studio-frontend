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

/**
 * Fetches the list of installed libraries from the backend.
 */
export async function fetchInstalledLibraries() {
    const response = await axios.get(`${COMPILER_URL}/lib-list`);
    return response.data.libraries || [];
}

/**
 * Searches for libraries in the Arduino registry.
 */
export async function searchLibraries(query) {
    const response = await axios.get(`${COMPILER_URL}/lib-search?q=${encodeURIComponent(query)}`);
    return response.data.libraries || [];
}

/**
 * Installs a library on the backend.
 */
export async function installLibrary(name) {
    const response = await axios.post(`${COMPILER_URL}/lib-install`, { name });
    return response.data;
}
