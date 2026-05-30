// Telemetry serialization worker
// This worker receives raw state objects, performs heavy JSON.stringify and deep cloning
// and then posts the serialized strings back to the main simulation worker.

self.onmessage = (e) => {
    const { type, payloadId, rawData } = e.data;

    if (type === 'SERIALIZE') {
        try {
            // Perform the heavy serialization off the main thread
            const serialized = JSON.stringify(rawData);
            
            self.postMessage({
                type: 'SERIALIZED_RESULT',
                payloadId,
                serialized
            });
        } catch (err) {
            self.postMessage({
                type: 'SERIALIZE_ERROR',
                payloadId,
                error: String(err)
            });
        }
    }
};
