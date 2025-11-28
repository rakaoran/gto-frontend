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
    <div class="min-h-screen flex flex-col items-center justify-center bg-[#1F1F1F] text-gray-300 p-4 font-sans selection:bg-[#00E5FF] selection:text-black overflow-hidden relative">

        <div class="absolute top-0 left-0 w-[500px] h-[500px] bg-[#00E5FF] rounded-full mix-blend-screen filter blur-[150px] opacity-5 pointer-events-none"></div>
        <div class="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#FF0033] rounded-full mix-blend-screen filter blur-[150px] opacity-5 pointer-events-none"></div>

        <div class="w-full max-w-7xl mb-4 relative z-10">
            <div class="flex items-center justify-between p-3 bg-[#000000] border border-[#00E5FF] shadow-[0_0_10px_rgba(0,229,255,0.1)]">
                <div class="flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full animate-pulse" :class="isConnected ? 'bg-[#00E5FF]' : 'bg-[#FF0033]'"></div>
                    <h2 class="text-sm font-mono font-bold uppercase tracking-widest text-[#00E5FF]">
                        SYS_STATUS :: <span class="text-white">{{ statusMessage }}</span>
                    </h2>
                </div>
            </div>
        </div>

        <div class="flex flex-col lg:flex-row w-full max-w-7xl gap-6 relative z-10 h-[85vh]">

            <div class="w-full lg:w-64 bg-[#000000] border border-[#1F1F1F] flex flex-col shrink-0">
                <div class="p-4 border-b border-[#1F1F1F] bg-[#050505]">
                    <h3 class="text-xs font-bold text-[#FF0033] uppercase tracking-widest mb-1">// ROSTER</h3>
                    <p class="text-[10px] text-gray-500 font-mono">CONNECTED_AGENTS: {{ players.length }}</p>
                </div>
                
                <div class="p-4 space-y-3 overflow-y-auto grow scrollbar-thin scrollbar-thumb-[#1F1F1F] scrollbar-track-black">
                    <button 
                        v-if="gameRoomId" 
                        @click="copyInviteLink"
                        class="w-full mb-2 bg-[#1F1F1F] hover:bg-[#2A2A2A] border border-[#00E5FF] text-[#00E5FF] text-[10px] font-bold py-2 px-2 uppercase tracking-wide flex items-center justify-center gap-2 transition-all hover:shadow-[0_0_8px_rgba(0,229,255,0.3)] group"
                        title="Copy Invite Link"
                    >
                        <span>COPY_LINK</span>
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                    </button>

                    <ul class="space-y-1">
                        <li v-for="player in players" :key="player.username"
                            class="flex justify-between items-center p-2 border-l-2 transition-all"
                            :class="player.guessed ? 'bg-[#00E5FF]/10 border-[#00E5FF]' : 'bg-[#1F1F1F]/30 border-[#1F1F1F]'">
                            <div class="flex items-center gap-2">
                                <span class="text-xs font-bold" :class="player.guessed ? 'text-[#00E5FF]' : 'text-gray-400'">
                                    {{ player.username }}
                                </span>
                                <svg v-if="player.guessed" xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-[#00E5FF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                            <span class="font-mono text-xs text-white">{{ player.score }}</span>
                        </li>
                    </ul>
                </div>
            </div>

            <div class="grow flex flex-col min-w-0">
                <div class="relative grow bg-[#050505] border-2 border-[#1F1F1F] flex flex-col">
                    
                    <div class="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#FF0033] z-20"></div>
                    <div class="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#FF0033] z-20"></div>
                    <div class="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#FF0033] z-20"></div>
                    <div class="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#FF0033] z-20"></div>

                    <div ref="dendeContainer"
                        class="w-full h-full cursor-crosshair flex items-center justify-center overflow-hidden"
                        style="touch-action: none;">
                    </div>

                    <div v-if="showTurnSummary"
                        class="absolute inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
                        <div class="bg-[#000000] border border-[#00E5FF] p-8 w-full max-w-md shadow-[0_0_30px_rgba(0,229,255,0.15)] relative">
                            <h2 class="text-2xl font-black text-white uppercase italic mb-6 text-center">// ROUND_STATS</h2>
                            <ul class="space-y-2 mb-6 font-mono text-sm">
                                <li v-for="res in turnResults" :key="res.username"
                                    class="flex justify-between p-2 border-b border-[#1F1F1F]">
                                    <span class="text-gray-300">{{ res.username }}</span>
                                    <span class="font-bold" 
                                          :class="res.gain > 0 ? 'text-[#00E5FF]' : 'text-gray-600'">
                                        <span v-if="res.gain > 0">+</span>{{ res.gain }}
                                    </span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div v-if="showLeaderboard"
                        class="absolute inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-50">
                        <div class="bg-[#000000] border-2 border-[#FF0033] p-8 w-full max-w-md text-center shadow-[0_0_50px_rgba(255,0,51,0.2)]">
                            <h2 class="text-4xl font-black mb-8 text-white uppercase tracking-tighter italic">
                                GAME <span class="text-[#FF0033]">OVER</span>
                            </h2>
                            <ul class="space-y-3 mb-8">
                                <li v-for="(player, index) in players" :key="player.username"
                                    class="flex justify-between items-center p-3 border"
                                    :class="index === 0 ? 'bg-[#FF0033]/10 border-[#FF0033]' : 'border-[#1F1F1F] bg-[#1F1F1F]/20'">
                                    <div class="flex items-center gap-3">
                                        <span class="font-bold font-mono" :class="index === 0 ? 'text-[#FF0033]' : 'text-gray-500'">#{{ index + 1 }}</span>
                                        <span class="uppercase tracking-wide font-bold">{{ player.username }}</span>
                                    </div>
                                    <span class="font-mono text-[#00E5FF]">{{ player.score }} PTS</span>
                                </li>
                            </ul>
                            <button @click="goHome" class="bg-[#00E5FF] hover:bg-[#33efff] text-black font-black py-3 px-8 uppercase tracking-widest transition-transform hover:scale-105">
                                EXIT_TO_MAIN
                            </button>
                        </div>
                    </div>

                    <div v-if="wordChoices.length > 0"
                        class="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
                        <div class="bg-[#000000] p-8 border border-[#00E5FF] shadow-2xl max-w-lg w-full">
                            <h2 class="text-xl font-bold text-center mb-2 text-white uppercase tracking-widest">INPUT_REQUIRED</h2>
                            <p class="text-center text-[#00E5FF] mb-8 text-xs font-mono animate-pulse">SELECT TARGET OBJECT</p>
                            
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <button v-for="(word, index) in wordChoices" :key="word" @click="sendWordChoice(index)"
                                    class="group relative px-4 py-6 border border-[#1F1F1F] bg-[#050505] hover:border-[#FF0033] hover:bg-[#FF0033]/10 transition-all flex flex-col items-center justify-center">
                                    <span class="text-sm font-bold uppercase tracking-wider group-hover:text-white transition-colors text-gray-400">{{ word }}</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div v-if="isMyTurnToDraw && wordChoices.length === 0" class="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                        <div class="bg-[#FF0033] text-black px-6 py-2 font-black uppercase tracking-widest text-xs shadow-[0_0_15px_#FF0033] animate-pulse">
                             active_drawer // 80s
                        </div>
                    </div>
                </div>

                <div class="mt-4 bg-[#000000] border border-[#1F1F1F] p-3 flex items-center gap-4 relative z-20"
                     :class="{ 'opacity-50 grayscale pointer-events-none': !isMyTurnToDraw }">
                    
                    <div class="relative w-10 h-10 shrink-0 group">
                        <div class="absolute inset-0 border border-[#1F1F1F] group-hover:border-[#00E5FF] transition-colors bg-transparent pointer-events-none z-10"></div>
                        <input type="color" v-model="currentColor" @change="updateSettings"
                            class="w-full h-full opacity-0 absolute inset-0 cursor-pointer z-20">
                        <div class="w-full h-full" :style="{ backgroundColor: currentColor }"></div>
                    </div>

                    <div class="flex flex-col grow gap-1">
                        <div class="flex justify-between items-center text-[10px] uppercase font-mono text-gray-500">
                            <span>Stroke_Weight</span>
                            <span>{{ currentSize }}px</span>
                        </div>
                        <input type="range" v-model.number="currentSize" @input="updateSettings" min="1" max="20"
                            class="w-full h-1 bg-[#1F1F1F] appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#00E5FF] [&::-webkit-slider-thumb]:rounded-none">
                    </div>

                    <div class="flex border border-[#1F1F1F] divide-x divide-[#1F1F1F]">
                        <button @click="() => { currentMode = 'drawing'; updateSettings() }"
                            class="px-3 py-2 transition-colors hover:bg-[#1F1F1F] group"
                            :class="currentMode === 'drawing' ? 'bg-[#1F1F1F]' : 'bg-transparent'">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" :class="currentMode === 'drawing' ? 'text-[#00E5FF]' : 'text-gray-500'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.586 7.586"></path><circle cx="11" cy="11" r="2"></circle></svg>
                        </button>
                        <button @click="() => { currentMode = 'filling'; updateSettings() }"
                            class="px-3 py-2 transition-colors hover:bg-[#1F1F1F]"
                            :class="currentMode === 'filling' ? 'bg-[#1F1F1F]' : 'bg-transparent'">
                             <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" :class="currentMode === 'filling' ? 'text-[#00E5FF]' : 'text-gray-500'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><path d="M19 11l-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11z"></path><path d="M5 2l5 5"></path><path d="M2 13h15"></path><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4z"></path></svg>
                        </button>
                    </div>

                    <div class="flex gap-2 pl-4 border-l border-[#1F1F1F]">
                        <button @click="undo" class="p-2 text-gray-500 hover:text-white hover:bg-[#1F1F1F] transition-colors" title="Undo">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>
                        </button>
                        <button @click="redo" class="p-2 text-gray-500 hover:text-white hover:bg-[#1F1F1F] transition-colors" title="Redo">
                             <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><path d="M21 7v6h-6"></path><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"></path></svg>
                        </button>
                        <button @click="clear" class="p-2 text-[#FF0033] hover:bg-[#FF0033]/10 transition-colors" title="Clear">
                             <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </div>
                </div>
            </div>

            <div class="w-full lg:w-72 bg-[#000000] border border-[#1F1F1F] flex flex-col shrink-0 h-64 lg:h-auto">
                <div class="p-4 border-b border-[#1F1F1F] bg-[#050505] flex justify-between items-center">
                    <h3 class="text-xs font-bold text-[#00E5FF] uppercase tracking-widest">// COMM_LINK</h3>
                    <div class="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse"></div>
                </div>

                <div ref="chatBox"
                    class="grow overflow-y-auto p-3 space-y-3 font-mono text-xs scrollbar-thin scrollbar-thumb-[#1F1F1F] scrollbar-track-black">
                    <div v-for="(msg, index) in chatMessages" :key="index" class="wrap-break-word">
                        
                        <div v-if="msg.isSystem" class="text-center py-2 opacity-70">
                            <span class="inline-block border border-[#1F1F1F] text-[#FF0033] px-2 py-1 uppercase tracking-wider text-[10px]">
                                {{ msg.content }}
                            </span>
                        </div>

                        <div v-else>
                            <span class="font-bold" :class="msg.from === 'You' ? 'text-[#FF0033]' : 'text-[#00E5FF]'">
                                {{ msg.from === 'You' ? '>> SELF' : `>> ${msg.from}` }}:
                            </span>
                            <span class="text-gray-400 ml-1">{{ msg.content }}</span>
                        </div>
                    </div>
                </div>

                <form @submit.prevent="sendChatMessage" class="p-3 bg-[#050505] border-t border-[#1F1F1F] flex gap-2">
                    <input v-model="chatInput" type="text" placeholder="TRANSMIT..."
                        class="grow min-w-0 bg-[#1F1F1F] border border-transparent focus:border-[#00E5FF] text-white text-xs px-3 py-2 outline-none font-mono placeholder-gray-600 transition-colors" />
                    <button type="submit" class="shrink-0 w-8 h-8 flex items-center justify-center bg-[#1F1F1F] hover:bg-[#00E5FF] hover:text-black text-[#00E5FF] transition-colors border border-[#00E5FF]">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                </form>
            </div>

        </div>
    </div>
</template>