import { ref } from 'vue';

const events = ref({});

export default {
    on(event, callback) {
        if (!events.value[event]) {
            events.value[event] = [];
        }
        events.value[event].push(callback);
    },
    emit(event, ...args) {
        if (events.value[event]) {
            events.value[event].forEach(callback => {
                callback(...args);
            });
        }
    },
    off(event, callback) {
        if (events.value[event]) {
            if (callback) {
                const index = events.value[event].indexOf(callback);
                if (index > -1) {
                    events.value[event].splice(index, 1);
                }
            } else {
                events.value[event] = [];
            }
        }
    }
};
