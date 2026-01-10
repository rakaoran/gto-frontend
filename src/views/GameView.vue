<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
const SERIAL_INITIAL_PLAYERS_AND_SCORES = 5
const SERIAL_GAME_ID = 6

// --- Event Types ---
const EVENT_PLAYER_JOINED = 0
// const EVENT_PLAYER_RECONNECTED = 1
const EVENT_PLAYER_LEFT = 2
const EVENT_PlAYER_CHOOSING_WORD = 3
const EVENT_GAME_STARTED = 4
const EVENT_PLEASE_CHOOSE_WORD = 5
const EVENT_PLAYER_STARTED_DRAWING = 6
const EVENT_PLAYER_HAS_GUESSED_THE_WORD = 7
// const EVENT_TURN_SUMMARY = 8 (Handled via SERIAL_TURN_SUMMARY usually)
// const EVENT_NEXT_ROUND = 9
const EVENT_LEADERBOARD = 10 

// --- State ---
const route = useRoute()
const router = useRouter()
const dendeContainer = ref<HTMLElement | null>(null)
const socket = ref<WebSocket | null>(null)
const isConnected = ref(false)
const statusMessage = ref('Connecting...')
const chatBox = ref<HTMLElement | null>(null)
const chatInput = ref('')

interface Player {
    username: string
    score: number
    guessed: boolean
}

interface RoundResult {
    username: string
    gain: number
}

const players = ref<Player[]>([])
const turnResults = ref<RoundResult[]>([])
const chatMessages = ref<any[]>([])
const wordChoices = ref<string[]>([])
const showTurnSummary = ref(false)
const showLeaderboard = ref(false)
const isGameEnded = ref(false)
const hasGameStarted = ref(false)
const isMyTurnToDraw = ref(false)
const gameRoomId = ref('') // Store the game ID received from backend

const currentColor = ref('#000000')
const currentSize = ref(5)
const currentMode = ref<'drawing' | 'filling'>('drawing')

let dende: Dende | null = null

const addPlayerIfNeeded = (username: string) => {
    if (username && !players.value.find(p => p.username === username)) {
        players.value.push({ username, score: 0, guessed: false })
    }
}

const handleInitialPlayers = (payload: Uint8Array) => {
  const summary = TurnSummary.decode(payload)
  
  const newPlayers: Player[] = []
  summary.usernames.forEach((u: string, i: number) => {
    newPlayers.push({
      username: u,
      score: summary.scores[i],
      guessed: false
    })
  })

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
    const gameId = route.params.gameId

    let endpoint = '/matchmaking'
    if (gameId) {
        endpoint = `/join/${gameId}`
    }

    const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + endpoint
    socket.value = new WebSocket(wsUrl)
    socket.value.binaryType = "arraybuffer"

    socket.value.onopen = () => {
        if (gameId) {
            console.log(`Joining Game ${gameId}... 🚀`)
            statusMessage.value = "Joining game..."
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
                    // If leaderboard is showing, don't hide it for late drawings
                    if (!showLeaderboard.value) showTurnSummary.value = false
                    handleDrawingData(payload)
                    break
                case SERIAL_TURN_SUMMARY:
                    handleTurnSummary(payload)
                    break
                case SERIAL_INITIAL_PLAYERS_AND_SCORES:
                    handleInitialPlayers(payload)
                    break
                case SERIAL_GAME_ID:
                    handleGameId(payload)
                    break
                default:
                    console.warn("Unknown serial type:", type)
            }
        } catch (err) {
            console.error("Error processing message:", err)
        }
    }

    socket.value.onclose = (event: CloseEvent) => {
        isConnected.value = false
        console.log("Socket closed:", event.code, event.reason)

        if (isGameEnded.value) {
            statusMessage.value = "Game Over"
            return 
        }

        if (hasGameStarted.value) {
            statusMessage.value = "Game Ended"
            pushSystemMessage("Game ended as all players except you have left.")
            return
        }

        if (event.reason === "room-not-found") {
            statusMessage.value = "❌ Room not found!"
            pushSystemMessage("Error: That room doesn't exist. 🤷‍♂️")
        } else if (event.reason === "room-full") {
            statusMessage.value = "❌ Room is full!"
            pushSystemMessage("Error: That room is already full. 🚫")
        } else if (event.code === 1006) {
            statusMessage.value = "Unknown error occurred."
            pushSystemMessage("Connection failed. Unknown error. 😵")
        } else {
            statusMessage.value = "Disconnected."
        }
    }
}

const handleEvent = (payload: Uint8Array) => {
    const event = Event.decode(payload)
    console.log('Event:', event.type, event.data)

    switch (event.type) {
        case EVENT_GAME_STARTED:
            hasGameStarted.value = true 
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
        
        case EVENT_LEADERBOARD:
            isGameEnded.value = true 
            showTurnSummary.value = false
            showLeaderboard.value = true 
            statusMessage.value = "Game Over! 🏆"
            pushSystemMessage("Game Over! Check the leaderboard! 🏆")
            break
    }
}

const handleMessage = (payload: Uint8Array) => {
    const msg = Message.decode(payload)
    addPlayerIfNeeded(msg.from)
    chatMessages.value.push({ ...msg, isSystem: false })
    scrollToChatBottom()
}

const handleGameId = (payload: Uint8Array) => {
    const msg = Message.decode(payload)
    gameRoomId.value = msg.content
    console.log("Game Room ID received:", gameRoomId.value)
}

const handleTurnSummary = (payload: Uint8Array) => {
    const summary = TurnSummary.decode(payload)

    const currentScores = new Map<string, number>()
    players.value.forEach(p => currentScores.set(p.username, p.score))

    const newPlayers: Player[] = []
    const results: RoundResult[] = []

    summary.usernames.forEach((u: string, i: number) => {
        const newScore = summary.scores[i]
        const oldScore = currentScores.get(u) || 0
        const diff = newScore - oldScore

        results.push({
            username: u,
            gain: diff
        })

        newPlayers.push({
            username: u,
            score: newScore,
            guessed: false
        })
    })

    players.value = newPlayers.sort((a, b) => b.score - a.score)
    turnResults.value = results.sort((a, b) => b.gain - a.gain)

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

const copyInviteLink = () => {
    if (!gameRoomId.value) return
    const link = `${window.location.origin}/join/${gameRoomId.value}`
    navigator.clipboard.writeText(link).then(() => {
        pushSystemMessage('Invite link copied! 📋')
    }).catch(err => {
        console.error('Failed to copy: ', err)
        pushSystemMessage('Failed to copy link.')
    })
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

const goHome = () => {
    router.push('/')
}

onMounted(() => {
    dende = new Dende(800, 600)
    dende.setFPS(60)

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
    <div class="min-h-screen flex flex-col items-center justify-center bg-[#0F1115] text-[#E6E6E6] p-4 font-sans selection:bg-[#4C8DFF] selection:text-white">

        <div class="w-full max-w-[1400px] mb-4">
            <div class="flex items-center justify-between p-3 bg-[#171A21] border border-[#242833] rounded shadow-sm">
                <div class="flex items-center gap-3">
                    <div class="w-2.5 h-2.5 rounded-full" :class="isConnected ? 'bg-[#4C8DFF]' : 'bg-red-500'"></div>
                    <span class="text-sm font-medium text-[#A0A4AB]">Status: <span class="text-[#E6E6E6]">{{ statusMessage }}</span></span>
                </div>
            </div>
        </div>

        <div class="flex flex-col lg:flex-row w-full max-w-[1400px] gap-6 h-[85vh]">

            <div class="w-full lg:w-64 bg-[#171A21] border border-[#242833] flex flex-col shrink-0 rounded overflow-hidden">
                <div class="p-4 border-b border-[#242833] bg-[#171A21]">
                    <h3 class="text-sm font-semibold text-[#E6E6E6]">Players</h3>
                    <p class="text-xs text-[#A0A4AB] mt-1">{{ players.length }} connected</p>
                </div>
                
                <div class="p-3 space-y-2 overflow-y-auto grow scrollbar-thin scrollbar-thumb-[#242833] scrollbar-track-transparent">
                    <button 
                        v-if="gameRoomId" 
                        @click="copyInviteLink"
                        class="w-full mb-2 bg-[#171A21] hover:bg-[#242833] border border-[#4C8DFF] text-[#4C8DFF] text-xs font-medium py-2 px-3 rounded transition-colors flex items-center justify-center gap-2 group"
                        title="Copy Invite Link"
                    >
                        <span>Invite Friends</span>
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                    </button>

                    <ul class="space-y-1">
                        <li v-for="player in players" :key="player.username"
                            class="flex justify-between items-center p-2 rounded border border-transparent transition-colors"
                            :class="player.guessed ? 'bg-[#4C8DFF]/10 border-[#4C8DFF]/30' : 'hover:bg-[#242833]/50'">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-medium" :class="player.guessed ? 'text-[#4C8DFF]' : 'text-[#E6E6E6]'">
                                    {{ player.username }}
                                </span>
                                <svg v-if="player.guessed" xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-[#4C8DFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                            <span class="text-xs font-mono text-[#A0A4AB]">{{ player.score }}</span>
                        </li>
                    </ul>
                </div>
            </div>

            <div class="grow flex flex-col min-w-0">
                <div class="relative grow bg-[#121419] border border-[#242833] rounded-t flex flex-col items-center justify-center overflow-hidden">
                    
                    <div ref="dendeContainer"
                        class="cursor-crosshair shadow-lg bg-white"
                        style="touch-action: none; max-width: 100%; max-height: 100%;">
                    </div>

                    <div v-if="showTurnSummary"
                        class="absolute inset-0 bg-[#0F1115]/90 backdrop-blur-sm flex items-center justify-center z-50">
                        <div class="bg-[#171A21] border border-[#242833] rounded-lg p-6 w-full max-w-sm shadow-xl">
                            <h2 class="text-lg font-semibold text-[#E6E6E6] mb-4 text-center">Round Results</h2>
                            <ul class="space-y-2 mb-4">
                                <li v-for="res in turnResults" :key="res.username"
                                    class="flex justify-between p-2 border-b border-[#242833] text-sm">
                                    <span class="text-[#A0A4AB]">{{ res.username }}</span>
                                    <span class="font-bold font-mono" 
                                          :class="res.gain > 0 ? 'text-[#4C8DFF]' : 'text-[#A0A4AB]'">
                                        <span v-if="res.gain > 0">+</span>{{ res.gain }}
                                    </span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div v-if="showLeaderboard"
                        class="absolute inset-0 bg-[#0F1115]/95 flex items-center justify-center z-50">
                        <div class="bg-[#171A21] border border-[#242833] rounded-xl p-8 w-full max-w-md text-center shadow-2xl">
                            <h2 class="text-3xl font-bold mb-6 text-[#E6E6E6]">Game Over</h2>
                            <div class="space-y-2 mb-8">
                                <div v-for="(player, index) in players" :key="player.username"
                                    class="flex justify-between items-center p-3 rounded"
                                    :class="index === 0 ? 'bg-[#4C8DFF]/10 border border-[#4C8DFF]/30' : 'bg-[#0F1115] border border-[#242833]'">
                                    <div class="flex items-center gap-3">
                                        <span class="font-bold font-mono text-sm" :class="index === 0 ? 'text-[#4C8DFF]' : 'text-[#A0A4AB]'">#{{ index + 1 }}</span>
                                        <span class="font-medium text-[#E6E6E6]">{{ player.username }}</span>
                                    </div>
                                    <span class="font-mono text-sm text-[#A0A4AB]">{{ player.score }} pts</span>
                                </div>
                            </div>
                            <button @click="goHome" class="bg-[#4C8DFF] hover:bg-[#3b7cdb] text-white font-medium py-2.5 px-6 rounded transition-colors w-full">
                                Return to Main Menu
                            </button>
                        </div>
                    </div>

                    <div v-if="wordChoices.length > 0"
                        class="absolute inset-0 bg-[#0F1115]/80 backdrop-blur-sm flex items-center justify-center z-50">
                        <div class="bg-[#171A21] p-6 border border-[#242833] rounded-lg shadow-xl max-w-lg w-full">
                            <h2 class="text-lg font-semibold text-center mb-1 text-[#E6E6E6]">Your Turn</h2>
                            <p class="text-center text-[#A0A4AB] text-sm mb-6">Choose a word to draw</p>
                            
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <button v-for="(word, index) in wordChoices" :key="word" @click="sendWordChoice(index)"
                                    class="px-4 py-4 bg-[#0F1115] border border-[#242833] rounded hover:border-[#4C8DFF] hover:text-[#4C8DFF] transition-all text-sm font-medium text-[#E6E6E6]">
                                    {{ word }}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div v-if="isMyTurnToDraw && wordChoices.length === 0" class="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                        <div class="bg-[#4C8DFF] text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-lg">
                            You are drawing
                        </div>
                    </div>
                </div>

                <div class="bg-[#171A21] border-x border-b border-[#242833] p-3 flex items-center gap-4 rounded-b relative z-20"
                     :class="{ 'opacity-50 pointer-events-none': !isMyTurnToDraw }">
                    
                    <div class="relative w-8 h-8 shrink-0 rounded overflow-hidden border border-[#242833] group">
                        <input type="color" v-model="currentColor" @change="updateSettings"
                            class="w-[150%] h-[150%] absolute -top-1/4 -left-1/4 cursor-pointer p-0 border-0">
                    </div>

                    <div class="flex flex-col grow gap-1 max-w-[200px]">
                        <div class="flex justify-between items-center text-[10px] uppercase font-medium text-[#A0A4AB]">
                            <span>Size</span>
                            <span>{{ currentSize }}px</span>
                        </div>
                        <input type="range" v-model.number="currentSize" @input="updateSettings" min="1" max="20"
                            class="w-full h-1 bg-[#242833] rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#4C8DFF] [&::-webkit-slider-thumb]:rounded-full">
                    </div>

                    <div class="w-px h-8 bg-[#242833] mx-2"></div>

                    <div class="flex gap-1">
                        <button @click="() => { currentMode = 'drawing'; updateSettings() }"
                            class="p-2 rounded transition-colors"
                            :class="currentMode === 'drawing' ? 'bg-[#242833] text-[#4C8DFF]' : 'text-[#A0A4AB] hover:bg-[#242833]/50'">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.586 7.586"></path><circle cx="11" cy="11" r="2"></circle></svg>
                        </button>
                        <button @click="() => { currentMode = 'filling'; updateSettings() }"
                            class="p-2 rounded transition-colors"
                            :class="currentMode === 'filling' ? 'bg-[#242833] text-[#4C8DFF]' : 'text-[#A0A4AB] hover:bg-[#242833]/50'">
                             <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 11l-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11z"></path><path d="M5 2l5 5"></path><path d="M2 13h15"></path><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4z"></path></svg>
                        </button>
                    </div>

                    <div class="w-px h-8 bg-[#242833] mx-2"></div>

                    <div class="flex gap-1">
                        <button @click="undo" class="p-2 text-[#A0A4AB] hover:text-[#E6E6E6] hover:bg-[#242833]/50 rounded transition-colors" title="Undo">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>
                        </button>
                        <button @click="redo" class="p-2 text-[#A0A4AB] hover:text-[#E6E6E6] hover:bg-[#242833]/50 rounded transition-colors" title="Redo">
                             <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"></path><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"></path></svg>
                        </button>
                        <button @click="clear" class="p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors ml-2" title="Clear Canvas">
                             <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </div>
                </div>
            </div>

            <div class="w-full lg:w-72 bg-[#171A21] border border-[#242833] flex flex-col shrink-0 rounded overflow-hidden h-64 lg:h-auto">
                <div class="p-4 border-b border-[#242833] bg-[#171A21]">
                    <h3 class="text-sm font-semibold text-[#E6E6E6]">Chat</h3>
                </div>

                <div ref="chatBox"
                    class="grow overflow-y-auto p-3 space-y-2 text-sm scrollbar-thin scrollbar-thumb-[#242833] scrollbar-track-transparent">
                    <div v-for="(msg, index) in chatMessages" :key="index" class="wrap-break-word">
                        
                        <div v-if="msg.isSystem" class="text-center py-2">
                            <span class="inline-block bg-[#242833]/50 text-[#A0A4AB] px-2 py-1 rounded text-xs">
                                {{ msg.content }}
                            </span>
                        </div>

                        <div v-else>
                            <span class="font-bold" :class="msg.from === 'You' ? 'text-[#4C8DFF]' : 'text-[#A0A4AB]'">
                                {{ msg.from }}:
                            </span>
                            <span class="text-[#E6E6E6] ml-1">{{ msg.content }}</span>
                        </div>
                    </div>
                </div>

                <form @submit.prevent="sendChatMessage" class="p-3 bg-[#171A21] border-t border-[#242833] flex gap-2">
                    <input v-model="chatInput" type="text" placeholder="Type a guess..."
                        class="grow min-w-0 bg-[#0F1115] border border-[#242833] focus:border-[#4C8DFF] text-[#E6E6E6] text-sm px-3 py-2 rounded outline-none placeholder-[#A0A4AB] transition-colors" />
                </form>
            </div>

        </div>
    </div>
</template>