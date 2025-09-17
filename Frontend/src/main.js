import { createApp } from 'vue'
import App from './App.vue'
import Router from './router/index.js'
import './style.css'


let pyBridge;
if (typeof QWebChannel !== 'undefined' && typeof qt !== 'undefined') {
    new QWebChannel(qt.webChannelTransport, (channel) => {
        pyBridge = channel.objects.pyBridge
        window.pyBridge = pyBridge
    })
}

const app = createApp(App)
app.use(Router)
app.mount('#app')