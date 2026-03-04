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

/**
 * Uninstalls a library from the backend.
 */
export async function uninstallLibrary(name) {
    const response = await axios.post(`${COMPILER_URL}/lib-uninstall`, { name });
    return response.data;
}

/**
 * Sends a custom component to the backend to be permanently installed.
 */
export async function approveCustomComponent(componentPayload) {
    const response = await axios.post(`${COMPILER_URL}/admin/components/approve`, componentPayload);
    return response.data;
}

/**
 * Admins fetching the pending components
 */
export async function fetchPendingComponents() {
    const response = await axios.get(`${COMPILER_URL}/admin/components/pending`);
    return response.data.components || [];
}

/**
 * Users submitting a component for admin review
 */
export async function submitCustomComponent(payload) {
    const response = await axios.post(`${COMPILER_URL}/components/submit`, payload);
    return response.data;
}
