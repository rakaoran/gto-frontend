<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router' // <--- 1. Import useRouter
import { API_BASE_URL } from '../config'
import { Dende, type IDendePart, DendePartType } from '../dende'
import { DrawingData } from '../proto/drawing'
import { Event, Message, WordChoice, TurnSummary } from '../proto/serialization'

// --- Constants ---
const SERIAL_EVENT = 0
const SERIAL_MESSAGE = 1
const SERIAL_DRAWING = 2
const SERIAL_WORD_CHOICE = 3
const SERIAL_TURN_SUMMARY = 4
const SERIAL_INITIAL_PLAYERS_AND_SCORES = 5 // <--- This was missing!

// --- Event Types ---
const EVENT_PLAYER_JOINED = 0
const EVENT_PLAYER_LEFT = 2
const EVENT_PlAYER_CHOOSING_WORD = 3
const EVENT_GAME_STARTED = 4
const EVENT_PLEASE_CHOOSE_WORD = 5
const EVENT_PLAYER_STARTED_DRAWING = 6
const EVENT_PLAYER_HAS_GUESSED_THE_WORD = 7

// --- State ---
const route = useRoute()
const router = useRouter() // <--- 2. Initialize router
const dendeContainer = ref<HTMLElement | null>(null)
const socket = ref<WebSocket | null>(null)
const isConnected = ref(false)
const statusMessage = ref('Connecting...')
const chatBox = ref<HTMLElement | null>(null)
const chatInput = ref('')

// ... [Game Data, UI State, Dende Instance, Helper Functions remain the same] ...

interface Player {
    username: string
    score: number
    guessed: boolean
}
const players = ref<Player[]>([])
const chatMessages = ref<any[]>([])
const wordChoices = ref<string[]>([])
const showTurnSummary = ref(false)
const isMyTurnToDraw = ref(false)

const currentColor = ref('#000000')
const currentSize = ref(5)
const currentMode = ref<'drawing' | 'filling'>('drawing')

let dende: Dende | null = null

const addPlayerIfNeeded = (username: string) => {
    if (username && !players.value.find(p => p.username === username)) {
        players.value.push({ username, score: 0, guessed: false })
    }
}

// New Handler for Initial Data Sync
const handleInitialPlayers = (payload: Uint8Array) => {
  // We reuse TurnSummary structure because it contains lists of names and scores
  const summary = TurnSummary.decode(payload)
  
  const newPlayers: Player[] = []
  summary.usernames.forEach((u: string, i: number) => {
    newPlayers.push({
      username: u,
      score: summary.scores[i],
      guessed: false
    })
  })

  // Overwrite local players with the authoritative list from server
  players.value = newPlayers
  console.log("Synced initial players and scores:", newPlayers)
}

const scrollToChatBottom = () => {
    nextTick(() => {
        if (chatBox.value) {
            chatBox.value.scrollTop = chatBox.value.scrollHeight
        }
    })
}

const pushSystemMessage = (content: string) => {
    chatMessages.value.push({
        from: 'System',
        content: content,
        isSystem: true
    })
    scrollToChatBottom()
}

// --- WebSocket Logic ---

const connect = () => {
    // 3. Capture gameId locally so we can use it even after we change the URL
    const gameId = route.params.gameId

    let endpoint = '/matchmaking'
    if (gameId) {
        endpoint = `/join/${gameId}`
    }

    const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + endpoint
    socket.value = new WebSocket(wsUrl)
    socket.value.binaryType = "arraybuffer"

    socket.value.onopen = () => {
        // Check our local variable 'gameId', not route.params (which might change)
        if (gameId) {
            console.log(`Joining Game ${gameId}... 🚀`)
            statusMessage.value = "Joining game..."

            // 4. AESTHETIC FIX: Clean the URL to /game without reloading
            router.replace({ name: 'game' })
        } else {
            console.log("Connected to Matchmaking! 🚀")
            statusMessage.value = "Waiting for players..."
        }
        isConnected.value = true
    }

    socket.value.onmessage = async (event) => {
        try {
            const buffer = event.data as ArrayBuffer
            if (buffer.byteLength === 0) return

            const data = new Uint8Array(buffer)
            const type = data[data.length - 1]
            const payload = data.subarray(0, data.length - 1)

            switch (type) {
                case SERIAL_EVENT:
                    handleEvent(payload)
                    break
                case SERIAL_MESSAGE:
                    handleMessage(payload)
                    break
                case SERIAL_DRAWING:
                    showTurnSummary.value = false
                    handleDrawingData(payload)
                    break
                case SERIAL_TURN_SUMMARY:
                    handleTurnSummary(payload)
                    break
                case SERIAL_INITIAL_PLAYERS_AND_SCORES: // <--- Add this case back!
                    handleInitialPlayers(payload)
                    break
                default:
                    console.warn("Unknown serial type:", type)
            }
        } catch (err) {
            console.error("Error processing message:", err)
        }
    }

    socket.value.onclose = () => {
        isConnected.value = false
        statusMessage.value = "Disconnected."
    }
}

// ... [Rest of the file (Handlers, Sending Data, etc.) remains exactly the same] ...

const handleEvent = (payload: Uint8Array) => {
    const event = Event.decode(payload)
    console.log('Event:', event.type, event.data)

    switch (event.type) {
        case EVENT_GAME_STARTED:
            showTurnSummary.value = false
            statusMessage.value = 'Game started!'
            pushSystemMessage('Game started! 🚀')
            break

        case EVENT_PLAYER_JOINED:
            addPlayerIfNeeded(event.data)
            pushSystemMessage(`${event.data} joined!`)
            break

        case EVENT_PLAYER_LEFT:
            players.value = players.value.filter(p => p.username !== event.data)
            pushSystemMessage(`${event.data} left.`)
            break

        case EVENT_PlAYER_CHOOSING_WORD:
            showTurnSummary.value = false
            addPlayerIfNeeded(event.data)
            statusMessage.value = `${event.data} is choosing...`
            isMyTurnToDraw.value = false
            dende?.disableDrawing()
            dende?.clear()
            pushSystemMessage(`${event.data} is choosing a word...`)
            break

        case EVENT_PLEASE_CHOOSE_WORD:
            showTurnSummary.value = false
            statusMessage.value = 'Your turn! Choose a word:'
            wordChoices.value = event.data.split(':')
            isMyTurnToDraw.value = true
            break

        case EVENT_PLAYER_STARTED_DRAWING:
            showTurnSummary.value = false
            addPlayerIfNeeded(event.data)
            statusMessage.value = `${event.data} is drawing!`
            wordChoices.value = []
            dende?.clear()

            if (isMyTurnToDraw.value) {
                dende?.enableDrawing()
                updateSettings()
            } else {
                dende?.disableDrawing()
            }
            pushSystemMessage(`${event.data} is drawing!`)
            break

        case EVENT_PLAYER_HAS_GUESSED_THE_WORD:
            addPlayerIfNeeded(event.data)
            const p = players.value.find(p => p.username === event.data)
            if (p) p.guessed = true
            pushSystemMessage(`${event.data} guessed it! 🎉`)
            break
    }
}

const handleMessage = (payload: Uint8Array) => {
    const msg = Message.decode(payload)
    addPlayerIfNeeded(msg.from)
    chatMessages.value.push({ ...msg, isSystem: false })
    scrollToChatBottom()
}

const handleTurnSummary = (payload: Uint8Array) => {
    const summary = TurnSummary.decode(payload)

    // Sync player scores
    const newPlayers: Player[] = []
    summary.usernames.forEach((u: string, i: number) => {
        newPlayers.push({
            username: u,
            score: summary.scores[i],
            guessed: false
        })
    })
    players.value = newPlayers.sort((a, b) => b.score - a.score)

    showTurnSummary.value = true
    statusMessage.value = "Turn over!"
    dende.reset()
}

const handleDrawingData = (payload: Uint8Array) => {
    if (isMyTurnToDraw.value) return

    const decoded = DrawingData.decode(payload)

    const part: IDendePart = {
        type: decoded.type as unknown as DendePartType,
        isLineEnd: decoded.isLineEnd,
        coordinates: decoded.coordinates,
        color: [
            decoded.color[0] * 255,
            decoded.color[1] * 255,
            decoded.color[2] * 255,
            decoded.color[3]
        ],
        lineWidth: decoded.lineWidth
    }

    dende?.putPart(part)
}

const sendPart = (part: IDendePart) => {
    if (!socket.value || socket.value.readyState !== WebSocket.OPEN) return

    const payload = DrawingData.create({
        type: part.type,
        isLineEnd: part.isLineEnd,
        coordinates: part.coordinates,
        color: [
            part.color[0] / 255,
            part.color[1] / 255,
            part.color[2] / 255,
            part.color[3]
        ],
        lineWidth: part.lineWidth
    })

    const protoBytes = DrawingData.encode(payload).finish()
    const packet = new Uint8Array(protoBytes.length + 1)
    packet.set(protoBytes, 0)
    packet[protoBytes.length] = SERIAL_DRAWING

    socket.value.send(packet)
}

const sendWordChoice = (index: number) => {
    if (!socket.value) return
    const msg = WordChoice.create({ wordIndex: index })
    const bytes = WordChoice.encode(msg).finish()

    const packet = new Uint8Array(bytes.length + 1)
    packet.set(bytes, 0)
    packet[bytes.length] = SERIAL_WORD_CHOICE
    socket.value.send(packet)

    wordChoices.value = []
}

const sendChatMessage = () => {
    if (!socket.value || !chatInput.value.trim()) return

    const msg = Message.create({ content: chatInput.value, from: '' })
    const bytes = Message.encode(msg).finish()

    const packet = new Uint8Array(bytes.length + 1)
    packet.set(bytes, 0)
    packet[bytes.length] = SERIAL_MESSAGE
    socket.value.send(packet)

    chatMessages.value.push({ from: 'You', content: chatInput.value, isSystem: false })
    chatInput.value = ''
    scrollToChatBottom()
}

const updateSettings = () => {
    if (!dende) return
    const hex = currentColor.value
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)

    dende.setLineColorRGBA(r, g, b, 1)
    dende.setLineWidth(currentSize.value)
    dende.setDrawingMode(currentMode.value)
}

const undo = () => dende?.undo()
const redo = () => dende?.redo()
const clear = () => dende?.clear()

onMounted(() => {
    dende = new Dende(800, 600)

    if (dendeContainer.value) {
        dendeContainer.value.appendChild(dende.getHTMLElement())
    }

    dende.onPartCreated((part) => {
        if (isMyTurnToDraw.value) {
            sendPart(part)
        }
    })

    dende.disableDrawing()
    updateSettings()
    connect()
})

onUnmounted(() => {
    socket.value?.close()
})
</script>

<template>
    <div class="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">

        <div v-if="wordChoices.length > 0"
            class="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div class="bg-gray-800 p-8 rounded-lg shadow-xl">
                <h2 class="text-2xl font-bold text-center mb-6">Choose a word:</h2>
                <div class="flex space-x-4">
                    <button v-for="(word, index) in wordChoices" :key="word" @click="sendWordChoice(index)"
                        class="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition">
                        {{ word }}
                    </button>
                </div>
            </div>
        </div>

        <div v-if="showTurnSummary"
            class="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div class="bg-gray-800 p-8 rounded-lg w-full max-w-md">
                <h2 class="text-2xl font-bold text-center mb-6">Turn Over!</h2>
                <ul class="space-y-2">
                    <li v-for="player in players" :key="player.username"
                        class="flex justify-between p-2 bg-gray-700 rounded">
                        <span>{{ player.username }}</span>
                        <span class="font-bold text-yellow-400">{{ player.score }} pts</span>
                    </li>
                </ul>
            </div>
        </div>

        <div class="w-full max-w-7xl mb-4">
            <h2 class="text-xl font-bold text-center p-3 bg-gray-800 rounded-lg border-b-4 border-blue-600">
                {{ statusMessage }}
            </h2>
        </div>

        <div class="flex flex-col md:flex-row w-full max-w-7xl gap-4">

            <div class="w-full md:w-48 bg-gray-800 p-4 rounded-lg shadow-lg h-fit">
                <h3 class="text-lg font-bold mb-3 text-gray-400 uppercase tracking-wider">Players</h3>
                <ul class="space-y-2">
                    <li v-for="player in players" :key="player.username"
                        class="flex justify-between items-center bg-gray-700 p-2 rounded">
                        <span :class="{ 'text-green-400 font-bold': player.guessed }">
                            {{ player.username }}
                            <span v-if="player.guessed">✓</span>
                        </span>
                        <span class="font-mono text-sm">{{ player.score }}</span>
                    </li>
                </ul>
            </div>

            <div class="grow flex flex-col">
                <div ref="dendeContainer"
                    class="bg-white rounded-lg shadow-2xl overflow-hidden border-4 border-gray-700"
                    style="line-height: 0;"></div>

                <div class="bg-gray-800 p-4 rounded-lg shadow-md mt-4 flex items-center gap-4"
                    :class="{ 'opacity-50 pointer-events-none': !isMyTurnToDraw }">
                    <input type="color" v-model="currentColor" @change="updateSettings"
                        class="w-10 h-10 bg-transparent cursor-pointer">

                    <div class="flex flex-col grow">
                        <label class="text-xs text-gray-400">Size: {{ currentSize }}</label>
                        <input type="range" v-model.number="currentSize" @input="updateSettings" min="1" max="20"
                            class="w-full accent-blue-500">
                    </div>

                    <div class="flex bg-gray-700 rounded-lg p-1">
                        <button @click="() => { currentMode = 'drawing'; updateSettings() }"
                            class="px-3 py-1 text-sm font-bold rounded transition"
                            :class="currentMode === 'drawing' ? 'bg-blue-600 text-white shadow' : 'text-gray-400'">
                            Draw
                        </button>
                        <button @click="() => { currentMode = 'filling'; updateSettings() }"
                            class="px-3 py-1 text-sm font-bold rounded transition"
                            :class="currentMode === 'filling' ? 'bg-blue-600 text-white shadow' : 'text-gray-400'">
                            Fill
                        </button>
                    </div>

                    <div class="border-l border-gray-600 pl-4 flex gap-2">
                        <button @click="undo" class="p-2 text-gray-300 hover:bg-gray-700 rounded"
                            title="Undo">↩️</button>
                        <button @click="redo" class="p-2 text-gray-300 hover:bg-gray-700 rounded"
                            title="Redo">↪️</button>
                        <button @click="clear" class="p-2 text-red-400 hover:bg-red-900/30 rounded"
                            title="Clear">🗑️</button>
                    </div>
                </div>
            </div>

            <div class="w-full md:w-72 bg-gray-800 p-4 rounded-lg shadow-lg flex flex-col h-[600px]">
                <h3 class="text-lg font-bold mb-3 text-gray-400 uppercase tracking-wider">Chat</h3>

                <div ref="chatBox"
                    class="grow overflow-y-auto mb-3 space-y-2 pr-2 scrollbar-thin scrollbar-thumb-gray-600">
                    <div v-for="(msg, index) in chatMessages" :key="index" class="text-sm">
                        <div v-if="msg.isSystem" class="text-center my-2">
                            <span class="text-xs bg-gray-700 text-blue-300 px-2 py-1 rounded-full">{{ msg.content
                                }}</span>
                        </div>
                        <div v-else>
                            <span class="font-bold" :class="msg.from === 'You' ? 'text-yellow-400' : 'text-blue-400'">{{
                                msg.from }}:</span>
                            <span class="text-gray-300 ml-1">{{ msg.content }}</span>
                        </div>
                    </div>
                </div>

                <form @submit.prevent="sendChatMessage" class="flex gap-2">
                    <input v-model="chatInput" type="text" placeholder="Guess or chat..."
                        class="grow px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500" />
                    <button type="submit" class="bg-blue-600 px-3 rounded hover:bg-blue-500">➤</button>
                </form>
            </div>

        </div>
    </div>
</template>