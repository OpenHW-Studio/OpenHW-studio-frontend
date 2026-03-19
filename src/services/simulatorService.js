import axios from 'axios';

const COMPILER_URL = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}` : 'http://localhost:5001/api';

/**
 * Sends Arduino C++ code to the backend compiler.
 * @param {string|object} input - code string or compile payload
 * @returns {Promise<string>} The Intel Hex string
 */
export async function compileCode(input) {
    try {
        const payload = typeof input === 'string' ? { code: input } : (input || {});
        const response = await axios.post(`${COMPILER_URL}/compile`, payload);
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
 * Flash firmware to a physical board via backend uploader (avrdude/esptool through arduino-cli).
 */
export async function flashFirmware({ port, fqbn, hex, baudRate, resetMethod }) {
    try {
        const response = await axios.post(`${COMPILER_URL}/compile/flash`, { port, fqbn, hex, baudRate, resetMethod });
        return response.data;
    } catch (error) {
        if (error.response && error.response.data && error.response.data.details) {
            throw new Error(`Flashing Failed:\n${error.response.data.details}`);
        }
        if (error.response && error.response.data && error.response.data.error) {
            throw new Error(error.response.data.error);
        }
        throw error;
    }
}

export async function listHardwarePorts(showAll = false) {
    try {
        const response = await axios.get(`${COMPILER_URL}/compile/ports`, {
            params: { showAll: showAll ? 'true' : 'false' },
        });
        return response.data?.ports || [];
    } catch (error) {
        if (error.response && error.response.data && error.response.data.error) {
            throw new Error(error.response.data.error);
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
 * Rejects a specific component submission by its unique submissionId.
 * Uses submissionId (not component id) so only that one upload is removed.
 */
export async function rejectCustomComponent(submissionId) {
    const response = await axios.delete(`${COMPILER_URL}/admin/components/reject/${submissionId}`);
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

export async function getInstalledComponents() {
    const response = await axios.get(`${COMPILER_URL}/admin/components/installed`);
    return response.data.components || [];
}

export async function deleteInstalledComponent(id) {
    const response = await axios.delete(`${COMPILER_URL}/admin/components/installed/${id}`);
    return response.data;
}

export async function backupInstalledComponents() {
    const response = await axios.get(`${COMPILER_URL}/admin/components/backup`);
    return response.data.components || [];
}

/**
 * Fetches all installed (approved) components with their full source file contents.
 * Used by SimulatorPage to inject approved components into the local runtime registry.
 */
export async function fetchInstalledComponentsWithFiles() {
    const response = await axios.get(`${COMPILER_URL}/admin/components/backup`);
    return response.data.components || [];
}
